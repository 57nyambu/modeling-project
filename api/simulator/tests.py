import json

from django.test import TestCase


class ApiTests(TestCase):
    def post(self, url, body):
        return self.client.post(url, data=json.dumps(body), content_type="application/json")

    def test_meta(self):
        r = self.client.get("/api/meta")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["strategies"]), 3)

    def test_run_lifecycle(self):
        r = self.post("/api/runs", {"strategy": "express", "parameters": {"duration": 60, "seed": 3}})
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()
        self.assertEqual(data["strategy"], "express")
        self.assertIn("avg_wait", data["metrics"])
        self.assertEqual(len(data["trace"]["customers"]), data["metrics"]["customers_generated"])

        pk = data["id"]
        self.assertEqual(self.client.get(f"/api/runs/{pk}").status_code, 200)
        for chart in ("queue-length", "in-store", "busy-cashiers", "wait-histogram", "utilisation"):
            img = self.client.get(f"/api/runs/{pk}/charts/{chart}.png")
            self.assertEqual(img.status_code, 200)
            self.assertEqual(img["Content-Type"], "image/png")
        csv = self.client.get(f"/api/runs/{pk}/customers.csv")
        self.assertEqual(csv.status_code, 200)
        self.assertEqual(csv.content.decode().count("\n") - 1, data["metrics"]["customers_generated"])
        self.assertEqual(len(self.client.get("/api/runs").json()["results"]), 1)
        self.assertEqual(self.client.delete(f"/api/runs/{pk}").status_code, 204)

    def test_bad_input(self):
        self.assertEqual(self.post("/api/runs", {"strategy": "nope"}).status_code, 400)
        self.assertEqual(self.post("/api/runs", {"parameters": {"num_counters": 0}}).status_code, 400)
        self.assertEqual(self.post("/api/runs", {"parameters": {"duration": 100000, "arrival_rate": 5}}).status_code, 400)
        self.assertEqual(self.post("/api/runs", {"parameters": {"section_weights": 4}}).status_code, 400)
        self.assertEqual(self.post("/api/runs", {"parameters": "nope"}).status_code, 400)
        self.assertEqual(self.post("/api/runs", {"parameters": {"seed": "abc"}}).status_code, 400)
        self.assertEqual(self.post("/api/comparisons", {"replications": 1}).status_code, 400)

    def test_comparison(self):
        r = self.post("/api/comparisons", {"replications": 3, "parameters": {"duration": 60}})
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()
        self.assertEqual(set(data["results"]["summary"]), {"shortest_queue", "shortest_wait", "express"})
        for chart in ("avg-wait", "p90-wait", "by-category", "queue-over-time", "replications"):
            img = self.client.get(f"/api/comparisons/{data['id']}/charts/{chart}.png")
            self.assertEqual(img.status_code, 200, chart)
        csv = self.client.get(f"/api/comparisons/{data['id']}/replications.csv")
        self.assertEqual(csv.status_code, 200)
        self.assertEqual(csv.content.decode().strip().count("\n"), 3 * 3)  # header + 3 reps x 3 strategies

    def test_old_results_are_upgraded(self):
        from simulator.models import SimulationRun
        r = self.post("/api/runs", {"strategy": "shortest_wait", "parameters": {"duration": 60, "seed": 9}})
        pk = r.json()["id"]
        fresh = r.json()["metrics"]
        run = SimulationRun.objects.get(pk=pk)
        run.metrics = {"avg_wait": fresh["avg_wait"]}          # what an old version stored
        run.timeseries = {"t": [0, 1], "in_store": [0, 1], "queues": [[0, 0]]}
        run.save()
        upgraded = self.client.get(f"/api/runs/{pk}").json()
        self.assertEqual(upgraded["metrics"]["schema"], fresh["schema"])
        self.assertEqual(upgraded["metrics"]["avg_wait"], fresh["avg_wait"])
        self.assertIn("waiting", upgraded["timeseries"])

    def test_peak_profile_run(self):
        r = self.post("/api/runs", {"strategy": "shortest_queue",
                                    "parameters": {"duration": 120, "arrival_profile": "peak", "peak_amplitude": 1.5}})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["parameters"]["arrival_profile"], "peak")
