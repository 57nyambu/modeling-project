"""Checkout counter selection strategies.

Each strategy receives the arriving customer, the list of counters and the
current time, and returns the index of the chosen counter. Ties always go to the
lowest counter number so results are deterministic.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Sequence

from .config import EXPRESS_ITEM_LIMIT

if TYPE_CHECKING:  # pragma: no cover
    from .customers import CustomerProfile
    from .engine import Counter


class Strategy:
    key = "base"
    label = "Base"
    uses_express = False

    def choose(
        self, customer: "CustomerProfile", counters: Sequence["Counter"], now: float
    ) -> int:
        raise NotImplementedError

    @staticmethod
    def _shortest(indices: Sequence[int], counters: Sequence["Counter"]) -> int:
        return min(indices, key=lambda i: (counters[i].customers_present, i))


class ShortestQueue(Strategy):
    """Join the counter with the fewest customers (waiting + in service)."""

    key = "shortest_queue"
    label = "Shortest Queue"

    def choose(self, customer, counters, now):
        return self._shortest(range(len(counters)), counters)


class ShortestExpectedWait(Strategy):
    """Join the counter with the smallest predicted wait.

    W_c = remaining expected time of the person in service
          + sum of expected service times of everyone waiting.
    Customers can see basket sizes, not true service times.
    """

    key = "shortest_wait"
    label = "Shortest Estimated Waiting Time"

    def choose(self, customer, counters, now):
        return min(
            range(len(counters)), key=lambda i: (counters[i].estimated_wait(now), i)
        )


class ExpressNormal(Strategy):
    """<= 5 items -> express counters, otherwise normal counters; shortest queue within group."""

    key = "express"
    label = "Express and Normal Checkout"
    uses_express = True

    def choose(self, customer, counters, now):
        want_express = customer.items <= EXPRESS_ITEM_LIMIT
        eligible = [i for i, c in enumerate(counters) if c.express == want_express]
        if not eligible:  # e.g. zero express counters configured
            eligible = list(range(len(counters)))
        return self._shortest(eligible, counters)


STRATEGIES: dict[str, type[Strategy]] = {
    ShortestQueue.key: ShortestQueue,
    ShortestExpectedWait.key: ShortestExpectedWait,
    ExpressNormal.key: ExpressNormal,
}


def get_strategy(key: str) -> Strategy:
    try:
        return STRATEGIES[key]()
    except KeyError:
        raise ValueError(
            f"unknown strategy '{key}'. Choose one of: {', '.join(STRATEGIES)}"
        ) from None
