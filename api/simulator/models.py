from django.db import models


class SimulationRun(models.Model):
    """One run of one strategy. Parameters + seed fully reproduce it."""

    created_at = models.DateTimeField(auto_now_add=True)
    strategy = models.CharField(max_length=32)
    parameters = models.JSONField()
    metrics = models.JSONField()
    timeseries = models.JSONField()
    trace = models.JSONField(null=True, blank=True)  # animation timeline; omitted for very large runs

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Run {self.pk} ({self.strategy})"

    def summary(self) -> dict:
        m = self.metrics
        return {
            "id": self.pk,
            "created_at": self.created_at.isoformat(),
            "strategy": self.strategy,
            "strategy_label": m.get("strategy_label"),
            "seed": self.parameters.get("seed"),
            "duration": self.parameters.get("duration"),
            "arrival_rate": self.parameters.get("arrival_rate"),
            "num_counters": self.parameters.get("num_counters"),
            "customers_generated": m.get("customers_generated"),
            "customers_served": m.get("customers_served"),
            "avg_wait": m.get("avg_wait"),
            "utilisation": m.get("utilisation"),
        }


class StrategyComparison(models.Model):
    """All three strategies, R replications each, Common Random Numbers."""

    created_at = models.DateTimeField(auto_now_add=True)
    parameters = models.JSONField()
    replications = models.PositiveIntegerField()
    results = models.JSONField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Comparison {self.pk} ({self.replications} reps)"

    def summary(self) -> dict:
        s = self.results["summary"]
        return {
            "id": self.pk,
            "created_at": self.created_at.isoformat(),
            "replications": self.replications,
            "seed": self.parameters.get("seed"),
            "duration": self.parameters.get("duration"),
            "arrival_rate": self.parameters.get("arrival_rate"),
            "num_counters": self.parameters.get("num_counters"),
            "num_express": self.parameters.get("num_express"),
            "best_strategy": self.results["ranking_by_avg_wait"][0],
            "avg_wait": {k: v["measures"]["avg_wait"]["mean"] for k, v in s.items()},
        }
