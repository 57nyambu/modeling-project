"""Discrete-event simulation engine.

The clock jumps from one event to the next using a priority queue (heap).
Nothing changes between events, so nothing is computed there.

Events: ARRIVAL, SECTION_ARRIVE, SECTION_DEPART, CHECKOUT_ARRIVE, SERVICE_END.
"""

from __future__ import annotations

import heapq
import itertools
from collections import deque
from dataclasses import dataclass, field

from .config import SimulationConfig
from .customers import CustomerProfile, generate_customers
from .strategies import Strategy, get_strategy

# Event types. At equal times the lower number is processed first, so a counter
# finishing a service is freed before a new customer looks at the queues.
SERVICE_END = 0
CHECKOUT_ARRIVE = 1
SECTION_DEPART = 2
SECTION_ARRIVE = 3
ARRIVAL = 4

EVENT_NAMES = {
    SERVICE_END: "SERVICE_END",
    CHECKOUT_ARRIVE: "CHECKOUT_ARRIVE",
    SECTION_DEPART: "SECTION_DEPART",
    SECTION_ARRIVE: "SECTION_ARRIVE",
    ARRIVAL: "ARRIVAL",
}


@dataclass
class CustomerRecord:
    """Mutable timestamps collected while a customer moves through the store."""

    profile: CustomerProfile
    section_times: list[list[float]] = field(
        default_factory=list
    )  # [arrive, depart] per visit
    checkout_arrival: float | None = None
    counter: int | None = None
    service_start: float | None = None
    departure: float | None = None

    @property
    def state_at_end(self) -> str:
        if self.departure is not None:
            return "served"
        if self.service_start is not None:
            return "in_service"
        if self.checkout_arrival is not None:
            return "waiting"
        return "shopping"


class Counter:
    """One checkout counter: a single cashier with a FIFO queue."""

    def __init__(self, index: int, express: bool, customers: dict[int, CustomerRecord]):
        self.index = index
        self.express = express
        self._customers = customers
        self.queue: deque[int] = deque()
        self.current: int | None = None
        self.current_start = 0.0
        self.busy_time = 0.0
        self.served = 0
        # Time-weighted queue length bookkeeping
        self._last_change = 0.0
        self.queue_area = 0.0
        self.max_queue = 0
        self.queue_series: list[tuple[float, int]] = [(0.0, 0)]

    # --- information used by strategies --------------------------------
    @property
    def busy(self) -> bool:
        return self.current is not None

    @property
    def customers_present(self) -> int:
        return len(self.queue) + (1 if self.busy else 0)

    def estimated_wait(self, now: float) -> float:
        wait = 0.0
        if self.current is not None:
            expected = self._customers[self.current].profile.expected_service_time
            wait += max(0.0, expected - (now - self.current_start))
        for cid in self.queue:
            wait += self._customers[cid].profile.expected_service_time
        return wait

    # --- statistics -----------------------------------------------------
    def record_queue_change(self, now: float) -> None:
        q = len(self.queue)
        self.queue_area += self.queue_series[-1][1] * (now - self._last_change)
        self._last_change = now
        self.max_queue = max(self.max_queue, q)
        if self.queue_series[-1][0] == now:
            self.queue_series[-1] = (now, q)
        else:
            self.queue_series.append((now, q))

    def close(self, end: float) -> None:
        self.queue_area += self.queue_series[-1][1] * (end - self._last_change)
        self._last_change = end
        if self.current is not None:
            self.busy_time += (
                end - self.current_start
            )  # count only the part inside [0, T]


@dataclass
class SimulationResult:
    config: SimulationConfig
    strategy_key: str
    strategy_label: str
    customers: list[CustomerRecord]
    counters: list[Counter]
    system_series: list[tuple[float, int]]  # customers in store over time
    waiting_series: list[tuple[float, int]]  # customers waiting in all queues over time
    busy_series: list[tuple[float, int]]  # busy cashiers over time
    events_processed: int


class Simulation:
    def __init__(
        self,
        config: SimulationConfig,
        strategy: Strategy | str,
        customers: list[CustomerProfile] | None = None,
    ):
        config.validate()
        self.config = config
        self.strategy = (
            get_strategy(strategy) if isinstance(strategy, str) else strategy
        )
        profiles = customers if customers is not None else generate_customers(config)

        self.records: dict[int, CustomerRecord] = {
            p.id: CustomerRecord(p) for p in profiles
        }
        n_express = config.num_express if self.strategy.uses_express else 0
        self.counters = [
            Counter(i, i < n_express, self.records) for i in range(config.num_counters)
        ]

        self.clock = 0.0
        self._heap: list[tuple[float, int, int, int, int]] = []
        self._seq = itertools.count()
        self._in_store = 0
        self._waiting = 0
        self._busy = 0
        self._system_series: list[tuple[float, int]] = [(0.0, 0)]
        self._waiting_series: list[tuple[float, int]] = [(0.0, 0)]
        self._busy_series: list[tuple[float, int]] = [(0.0, 0)]
        self._events = 0

    # ------------------------------------------------------------------ #
    def _schedule(
        self, time: float, event: int, customer_id: int, extra: int = 0
    ) -> None:
        heapq.heappush(self._heap, (time, event, next(self._seq), customer_id, extra))

    def _record(self, series: list[tuple[float, int]], value: int) -> None:
        """Append a step-function point; several changes at one instant keep the last."""
        if series[-1][0] == self.clock:
            series[-1] = (self.clock, value)
        else:
            series.append((self.clock, value))

    def _set_in_store(self, delta: int) -> None:
        self._in_store += delta
        self._record(self._system_series, self._in_store)

    def _set_waiting(self, delta: int) -> None:
        self._waiting += delta
        self._record(self._waiting_series, self._waiting)

    def _set_busy(self, delta: int) -> None:
        self._busy += delta
        self._record(self._busy_series, self._busy)

    # ------------------------------------------------------------------ #
    def run(self) -> SimulationResult:
        T = self.config.duration
        for rec in self.records.values():
            self._schedule(rec.profile.arrival_time, ARRIVAL, rec.profile.id)

        while self._heap and self._heap[0][0] <= T:
            time, event, _, cid, extra = heapq.heappop(self._heap)
            self.clock = time
            self._events += 1
            if event == ARRIVAL:
                self._on_arrival(cid)
            elif event == SECTION_ARRIVE:
                self._on_section_arrive(cid, extra)
            elif event == SECTION_DEPART:
                self._on_section_depart(cid, extra)
            elif event == CHECKOUT_ARRIVE:
                self._on_checkout_arrive(cid)
            elif event == SERVICE_END:
                self._on_service_end(cid, extra)

        self.clock = T
        for counter in self.counters:
            counter.close(T)

        return SimulationResult(
            config=self.config,
            strategy_key=self.strategy.key,
            strategy_label=self.strategy.label,
            customers=sorted(self.records.values(), key=lambda r: r.profile.id),
            counters=self.counters,
            system_series=self._system_series,
            waiting_series=self._waiting_series,
            busy_series=self._busy_series,
            events_processed=self._events,
        )

    # --- event handlers ---------------------------------------------------
    def _on_arrival(self, cid: int) -> None:
        rec = self.records[cid]
        self._set_in_store(+1)
        first = rec.profile.visits[0]
        self._schedule(self.clock + first.walk_in_time, SECTION_ARRIVE, cid, 0)

    def _on_section_arrive(self, cid: int, visit_index: int) -> None:
        rec = self.records[cid]
        rec.section_times.append([self.clock, None])
        visit = rec.profile.visits[visit_index]
        self._schedule(self.clock + visit.shop_time, SECTION_DEPART, cid, visit_index)

    def _on_section_depart(self, cid: int, visit_index: int) -> None:
        rec = self.records[cid]
        rec.section_times[visit_index][1] = self.clock
        nxt = visit_index + 1
        if nxt < len(rec.profile.visits):
            walk = rec.profile.visits[nxt].walk_in_time
            self._schedule(self.clock + walk, SECTION_ARRIVE, cid, nxt)
        else:
            self._schedule(
                self.clock + rec.profile.walk_to_checkout, CHECKOUT_ARRIVE, cid
            )

    def _on_checkout_arrive(self, cid: int) -> None:
        rec = self.records[cid]
        rec.checkout_arrival = self.clock
        index = self.strategy.choose(rec.profile, self.counters, self.clock)
        rec.counter = index
        counter = self.counters[index]
        if not counter.busy and not counter.queue:
            self._start_service(counter, cid)
        else:
            counter.queue.append(cid)
            counter.record_queue_change(self.clock)
            self._set_waiting(+1)

    def _start_service(self, counter: Counter, cid: int) -> None:
        rec = self.records[cid]
        counter.current = cid
        counter.current_start = self.clock
        rec.service_start = self.clock
        self._set_busy(+1)
        self._schedule(
            self.clock + rec.profile.service_time, SERVICE_END, cid, counter.index
        )

    def _on_service_end(self, cid: int, counter_index: int) -> None:
        counter = self.counters[counter_index]
        rec = self.records[cid]
        rec.departure = self.clock
        counter.busy_time += self.clock - counter.current_start
        counter.served += 1
        counter.current = None
        self._set_in_store(-1)
        self._set_busy(-1)
        if counter.queue:  # FIFO
            nxt = counter.queue.popleft()
            counter.record_queue_change(self.clock)
            self._set_waiting(-1)
            self._start_service(counter, nxt)


def run_simulation(
    config: SimulationConfig,
    strategy: str,
    customers: list[CustomerProfile] | None = None,
) -> SimulationResult:
    return Simulation(config, strategy, customers).run()
