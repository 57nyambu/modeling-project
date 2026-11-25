"""Engine verification tests.

Run from the api folder:
    python -m unittest discover -s simulation/tests -t . -v
"""

import unittest
from dataclasses import replace

from unittest import mock

from simulation import (
    SimulationConfig,
    build_trace,
    compute_metrics,
    generate_customers,
    layout,
    run_simulation,
)
from simulation.comparison import compare_strategies, summarise
from simulation.customers import CustomerProfile, SectionVisit
from simulation.strategies import STRATEGIES
from simulation.validation import mm1_theory, mmc_theory, run_mm1_validation

BASE = SimulationConfig(
    duration=240, seed=11, arrival_rate=1.6, num_counters=4, num_express=1
)


def make_customer(cid, arrival, items, shop, service, walk=0.0):
    """Hand-built customer with one section visit, for worked examples."""
    return CustomerProfile(
        id=cid,
        arrival_time=arrival,
        category="small" if items <= 5 else "medium",
        items=items,
        walk_speed=1.0,
        visits=(SectionVisit("grocery", items, shop, walk),),
        walk_to_checkout=0.0,
        service_time=service,
        expected_service_time=service,
    )


class TestConfig(unittest.TestCase):
    def test_rejects_bad_values(self):
        with self.assertRaises(ValueError):
            SimulationConfig.from_dict({"num_counters": 0})
        with self.assertRaises(ValueError):
            SimulationConfig.from_dict(
                {"p_small": 0.5, "p_medium": 0.5, "p_large": 0.5}
            )
        with self.assertRaises(ValueError):
            SimulationConfig.from_dict({"num_express": 5, "num_counters": 4})
        with self.assertRaises(ValueError):
            SimulationConfig.from_dict({"not_a_parameter": 1})

    def test_from_dict_roundtrip(self):
        cfg = SimulationConfig.from_dict(BASE.to_dict())
        self.assertEqual(cfg, BASE)


class TestHandWorkedExample(unittest.TestCase):
    """Three customers, one counter. Expected timeline worked out by hand:

    C1 arrives 0, shops 1  -> checkout 1, service 1..4   (wait 0)
    C2 arrives 1, shops 1  -> checkout 2, queues, service 4..6 (wait 2)
    C3 arrives 2, shops 0.5-> checkout 2.5, queues, service 6..7 (wait 3.5)
    """

    def setUp(self):
        self.cfg = SimulationConfig(duration=20, num_counters=1, num_express=0)
        self.customers = [
            make_customer(1, 0, 3, 1.0, 3.0),
            make_customer(2, 1, 3, 1.0, 2.0),
            make_customer(3, 2, 3, 0.5, 1.0),
        ]

    def test_timeline(self):
        res = run_simulation(self.cfg, "shortest_queue", self.customers)
        got = [
            (r.checkout_arrival, r.service_start, r.departure) for r in res.customers
        ]
        self.assertEqual(got, [(1.0, 1.0, 4.0), (2.0, 4.0, 6.0), (2.5, 6.0, 7.0)])

    def test_metrics(self):
        m = compute_metrics(run_simulation(self.cfg, "shortest_queue", self.customers))
        self.assertAlmostEqual(m["avg_wait"], (0 + 2 + 3.5) / 3)
        self.assertAlmostEqual(m["max_wait"], 3.5)
        self.assertEqual(m["max_queue_length"], 2)
        # Queue: 1 person over [2,2.5), 2 over [2.5,4), 1 over [4,6) -> area 0.5+3+2 = 5.5
        self.assertAlmostEqual(m["avg_queue_length"], 5.5 / 20)
        self.assertAlmostEqual(m["utilisation"], 6 / 20)  # busy 1..7
        self.assertAlmostEqual(m["avg_time_in_store"], (4 + 5 + 5) / 3)
        self.assertEqual(m["remaining"], 0)

    def test_cut_off_at_end(self):
        cfg = replace(self.cfg, duration=5)
        m = compute_metrics(run_simulation(cfg, "shortest_queue", self.customers))
        self.assertEqual(m["customers_served"], 1)
        self.assertEqual(m["remaining"], 2)
        self.assertEqual(
            m["remaining_breakdown"], {"shopping": 0, "waiting": 1, "in_service": 1}
        )
        self.assertAlmostEqual(m["utilisation"], 4 / 5)  # busy 1..5 clipped at T


class TestEngineInvariants(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.customers = generate_customers(BASE)
        cls.results = {k: run_simulation(BASE, k, cls.customers) for k in STRATEGIES}

    def test_reproducible(self):
        a = compute_metrics(run_simulation(BASE, "shortest_wait"))
        b = compute_metrics(run_simulation(BASE, "shortest_wait"))
        self.assertEqual(a, b)

    def test_common_random_numbers(self):
        again = generate_customers(BASE)
        self.assertEqual(again, self.customers)
        for res in self.results.values():
            self.assertEqual(len(res.customers), len(self.customers))
            for rec, prof in zip(res.customers, self.customers):
                self.assertEqual(rec.profile, prof)

    def test_fifo_and_single_server(self):
        for res in self.results.values():
            for c in range(BASE.num_counters):
                recs = [
                    r
                    for r in res.customers
                    if r.counter == c and r.service_start is not None
                ]
                by_join = sorted(recs, key=lambda r: (r.checkout_arrival, r.profile.id))
                by_start = sorted(recs, key=lambda r: (r.service_start, r.profile.id))
                self.assertEqual(
                    [r.profile.id for r in by_join], [r.profile.id for r in by_start]
                )
                for prev, nxt in zip(by_start, by_start[1:]):
                    end = (
                        prev.departure if prev.departure is not None else BASE.duration
                    )
                    self.assertLessEqual(end, nxt.service_start + 1e-9)

    def test_conservation_and_bounds(self):
        for res in self.results.values():
            m = compute_metrics(res)
            self.assertEqual(
                m["customers_generated"],
                m["customers_served"] + sum(m["remaining_breakdown"].values()),
            )
            self.assertGreaterEqual(m["avg_wait"], 0)
            for c in m["counters"]:
                self.assertGreaterEqual(c["utilisation"], 0)
                self.assertLessEqual(c["utilisation"], 1 + 1e-9)

    def test_time_weighted_queue_equals_total_waiting(self):
        """Integral of Q(t) over [0,T] = sum of each customer's waiting time inside [0,T]."""
        T = BASE.duration
        for res in self.results.values():
            m = compute_metrics(res)
            total = sum(
                (
                    min(r.service_start if r.service_start is not None else T, T)
                    - r.checkout_arrival
                )
                for r in res.customers
                if r.checkout_arrival is not None
            )
            self.assertAlmostEqual(m["avg_total_waiting"] * T, total, places=6)

    def test_express_rule(self):
        res = self.results["express"]
        for r in res.customers:
            if r.counter is None:
                continue
            express = r.counter < BASE.num_express
            self.assertEqual(express, r.profile.items <= 5)

    def test_shortest_queue_rule(self):
        cfg = SimulationConfig(duration=20, num_counters=2, num_express=0)
        customers = [
            make_customer(1, 0, 3, 1.0, 10.0),
            make_customer(2, 0.5, 3, 1.0, 1.0),
        ]
        res = run_simulation(cfg, "shortest_queue", customers)
        self.assertEqual([r.counter for r in res.customers], [0, 1])

    def test_shortest_wait_prefers_lighter_queue(self):
        # Counter 0: one customer expected 1 min. Counter 1 busy with someone expected 9 min.
        cfg = SimulationConfig(duration=30, num_counters=2, num_express=0)
        customers = [
            make_customer(1, 0, 3, 1.0, 9.0),  # -> counter 0 (tie, lowest index)
            make_customer(2, 0, 3, 1.1, 1.0),  # -> counter 1 (idle)
            make_customer(3, 0, 3, 1.2, 1.0),  # SQ: tie -> 0; SEWT: counter 1 is sooner
        ]
        sq = run_simulation(cfg, "shortest_queue", customers)
        sewt = run_simulation(cfg, "shortest_wait", customers)
        self.assertEqual(sq.customers[2].counter, 0)
        self.assertEqual(sewt.customers[2].counter, 1)


class TestNewMeasures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = run_simulation(BASE, "shortest_queue")
        cls.m = compute_metrics(cls.result)

    def test_busy_series_matches_utilisation(self):
        # Time-average of busy cashiers / C must equal the mean utilisation
        self.assertAlmostEqual(self.m["avg_busy_cashiers"] / BASE.num_counters, self.m["utilisation"], places=9)

    def test_waiting_series_matches_queue_areas(self):
        from simulation.metrics import time_average
        self.assertAlmostEqual(time_average(self.result.waiting_series, BASE.duration),
                               self.m["avg_total_waiting"], places=9)

    def test_wait_distribution_counts(self):
        d = self.m["wait_distribution"]
        self.assertEqual(d["zero"] + d["positive"], self.m["customers_started_service"])
        self.assertEqual(sum(d["counts"]), d["positive"])
        self.assertAlmostEqual(1 - d["zero"] / self.m["customers_started_service"], self.m["prob_wait"])
        self.assertLessEqual(self.m["p90_wait"], self.m["max_wait"] + 1e-12)

    def test_time_average_hand_example(self):
        from simulation.metrics import time_average
        # 0 on [0,2), 3 on [2,5), 1 on [5,10) -> (0*2 + 3*3 + 1*5) / 10 = 1.4
        self.assertAlmostEqual(time_average([(0, 0), (2, 3), (5, 1)], 10), 1.4)

    def test_step_envelope_keeps_peaks(self):
        from simulation.metrics import step_points
        series = [(0.0, 0)] + [(i * 0.01, (i % 7)) for i in range(1, 9000)]
        pts, decimated = step_points(series, 100.0, max_points=1000)
        self.assertTrue(decimated)
        self.assertLessEqual(len(pts), 1000)
        self.assertEqual(max(v for _, v in pts), 6)


class TestPeakArrivals(unittest.TestCase):
    def test_rate_function_averages_to_lambda(self):
        cfg = SimulationConfig(arrival_profile="peak", peak_amplitude=1.2, arrival_rate=2.0, duration=300)
        grid = [cfg.arrival_rate_at(t) for t in [i * 0.3 for i in range(1000)]]
        self.assertAlmostEqual(sum(grid) / len(grid), 2.0, places=2)
        self.assertAlmostEqual(cfg.arrival_rate_at(150), 2.0 * 1.6)
        self.assertAlmostEqual(cfg.arrival_rate_at(0), 2.0 * 0.4)

    def test_thinning_reproduces_profile(self):
        counts_mid, counts_edge, total = 0, 0, 0
        for seed in range(20):
            cfg = SimulationConfig(arrival_profile="peak", peak_amplitude=1.0, seed=seed, duration=240)
            times = [c.arrival_time for c in generate_customers(cfg)]
            total += len(times)
            counts_mid += sum(1 for t in times if 100 <= t < 140)
            counts_edge += sum(1 for t in times if t < 40)
        # Expected total 20 * 1.4 * 240 = 6720; middle 40 minutes run near 1.5x, first 40 near 0.6x
        self.assertAlmostEqual(total / 6720, 1.0, delta=0.05)
        self.assertGreater(counts_mid, 2 * counts_edge)

    def test_constant_profile_unchanged(self):
        a = [c.arrival_time for c in generate_customers(BASE)]
        b = [c.arrival_time for c in generate_customers(replace(BASE, peak_amplitude=1.5))]
        self.assertEqual(a, b)  # amplitude is ignored unless the profile is "peak"

    def test_rejects_bad_profile(self):
        with self.assertRaises(ValueError):
            SimulationConfig.from_dict({"arrival_profile": "rush"})
        with self.assertRaises(ValueError):
            SimulationConfig.from_dict({"seed": 1.5})
        with self.assertRaises(ValueError):
            SimulationConfig.from_dict({"section_weights": 3})


class TestWalkways(unittest.TestCase):
    """Customers walk along aisles and never through shelving or checkout lanes."""

    @classmethod
    def setUpClass(cls):
        cls.customers = generate_customers(replace(BASE, duration=120))

    @staticmethod
    def samples(path, step=0.05):
        for (ax, ay), (bx, by) in zip(path, path[1:]):
            n = max(1, int(layout.distance((ax, ay), (bx, by)) / step))
            for k in range(n + 1):
                yield ax + (bx - ax) * k / n, ay + (by - ay) * k / n

    def test_aisles_lie_between_shelving(self):
        for name in layout.SECTION_RECTS:
            shelves = layout.gondolas(name)
            for x, y, w, h in shelves:
                for row in layout.AISLE_ROWS:
                    self.assertFalse(y - 0.2 < row < y + h + 0.2, "aisle too close to a shelf")
                for v in layout.CROSS_AISLES:
                    self.assertFalse(x - 0.2 < v < x + w + 0.2, "cross-aisle runs through a shelf")

    def test_routes_avoid_shelving_and_lanes(self):
        shelves = [g for name in layout.SECTION_RECTS for g in layout.gondolas(name)]
        for c in self.customers:
            for path in c.paths:
                for px, py in self.samples(path):
                    self.assertTrue(0 < px < layout.STORE_WIDTH and 0 < py < layout.STORE_HEIGHT)
                    for x, y, w, h in shelves:
                        self.assertFalse(x < px < x + w and y < py < y + h, f"customer {c.id} walks through a shelf")
                    if py > layout.CHECKOUT_POINT[1] + 0.01:  # below the open floor: only the entrance walkway
                        self.assertLess(px, layout.COUNTER_X_MIN - 1.0)

    def test_paths_connect_and_set_walking_times(self):
        for c in self.customers:
            self.assertEqual(len(c.paths), len(c.visits) + 1)
            self.assertEqual(c.paths[0][0], layout.ENTRANCE)
            self.assertEqual(c.paths[-1][-1], layout.CHECKOUT_POINT)
            for i, visit in enumerate(c.visits):
                self.assertEqual(c.paths[i][-1], visit.spot)
                self.assertEqual(c.paths[i + 1][0], visit.spot)
                self.assertIn(visit.spot[1], layout.AISLE_ROWS)
                length = layout.path_length(c.paths[i])
                self.assertAlmostEqual(visit.walk_in_time, length / (60 * c.walk_speed), places=12)
                start = c.paths[i][0]
                self.assertGreaterEqual(length + 1e-9, layout.distance(start, visit.spot))
            self.assertAlmostEqual(
                c.walk_to_checkout, layout.path_length(c.paths[-1]) / (60 * c.walk_speed), places=12
            )

    def test_route_examples(self):
        back, middle, front = layout.AISLE_ROWS
        # Same aisle row: aisles line up across sections, so the walk is straight
        a, b = (5.0, back), (24.0, back)
        self.assertEqual(layout.route(a, b), [a, b])
        # Change of row at a cross-aisle between the two points: Manhattan distance
        a, b = (6.0, middle), (24.0, back)
        path = layout.route(a, b)
        self.assertAlmostEqual(layout.path_length(path), 18.0 + (middle - back))
        self.assertEqual(path[1][0], 20.0)  # turns at the cross-aisle next to the target section
        # Back aisle to the checkout: along the aisle, down a cross-aisle, across the open floor
        path = layout.route((32.0, back), layout.CHECKOUT_POINT)
        self.assertEqual(path[:3], [(32.0, back), (29.0, back), (29.0, front)])
        self.assertEqual(path[-1], layout.CHECKOUT_POINT)
        # Front aisle opens onto the main aisle: straight to the checkout
        self.assertEqual(layout.route((34.0, front), layout.CHECKOUT_POINT), [(34.0, front), layout.CHECKOUT_POINT])

    def test_spots_do_not_change_other_random_draws(self):
        def draws(customers):
            return [(c.arrival_time, c.items, c.walk_speed, c.service_time,
                     tuple((v.section, v.items, v.shop_time) for v in c.visits)) for c in customers]

        cfg = replace(BASE, duration=60)
        with mock.patch("simulation.customers.PLACEMENT_STREAM", 7):
            other = generate_customers(cfg)
        this = generate_customers(cfg)
        self.assertEqual(draws(this), draws(other))
        self.assertNotEqual([v.spot for c in this for v in c.visits], [v.spot for c in other for v in c.visits])

    def test_trace_routes_and_decisions(self):
        for key in STRATEGIES:
            result = run_simulation(BASE, key, record_decisions=True)
            trace = build_trace(result)
            express = {c["index"] for c in trace["counters"] if c["type"] == "express"}
            for c in trace["customers"]:
                self.assertEqual(len(c["p"]), len(c["legs"]) + 1)
                self.assertEqual(c["p"][0][0], list(layout.ENTRANCE))
                if c["co"] is None:
                    self.assertIsNone(c["seen"])
                    continue
                seen = c["seen"]
                self.assertEqual(len(seen), BASE.num_counters)
                if key == "shortest_wait":
                    best = min(range(len(seen)), key=lambda i: (seen[i][1], i))
                    self.assertAlmostEqual(seen[c["c"]][1], seen[best][1], places=2)
                else:
                    eligible = range(len(seen))
                    if key == "express" and express:
                        eligible = [i for i in eligible if (i in express) == (c["items"] <= trace["express_limit"])]
                    self.assertEqual(c["c"], min(eligible, key=lambda i: (seen[i][0], i)))
                # Somebody who saw an empty counter and joined it started service at once
                if seen[c["c"]][0] == 0:
                    self.assertEqual(c["ss"], c["co"])


class TestStatistics(unittest.TestCase):
    def test_summarise(self):
        s = summarise([1, 2, 3, 4])
        self.assertAlmostEqual(s["mean"], 2.5)
        self.assertAlmostEqual(s["sd"], 1.2909944, places=6)
        self.assertAlmostEqual(s["ci_half"], 3.182 * 1.2909944 / 2, places=5)

    def test_comparison_uses_same_customers(self):
        res = compare_strategies(replace(BASE, duration=120), replications=3)
        gen = {
            k: [r["customers_served"] + r["remaining"] for r in v]
            for k, v in res["per_replication"].items()
        }
        self.assertEqual(gen["shortest_queue"], gen["shortest_wait"])
        self.assertEqual(gen["shortest_queue"], gen["express"])

    def test_queueing_formulas(self):
        self.assertAlmostEqual(mm1_theory(0.5, 1)["wq"], 1.0)
        self.assertAlmostEqual(
            mmc_theory(0.5, 1, 1)["wq"], 1.0
        )  # M/M/c with c=1 is M/M/1
        self.assertAlmostEqual(mmc_theory(1.6, 1, 2)["p_wait"], 0.7111111, places=6)


class TestValidationAgainstTheory(unittest.TestCase):
    def test_mm1(self):
        v = run_mm1_validation(
            lam=0.6, mu=1.0, duration=10_000, replications=8, seed=100
        )
        for key, m in v["measures"].items():
            self.assertLess(m["relative_error"], 0.08, key)


if __name__ == "__main__":
    unittest.main()
