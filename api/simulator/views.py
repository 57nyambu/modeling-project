"""JSON API. The simulation engine (the `simulation` package) does the modelling;
these views only validate input, call the engine, store results and serve them.

CSRF is disabled on the JSON endpoints because this is a local, single-user
teaching application with no login. Do not expose it to the internet as-is.
"""

from __future__ import annotations

import io
import json
from functools import wraps

import pandas as pd
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from simulation import (RESULT_SCHEMA, STRATEGIES, SimulationConfig, build_trace, compare_strategies,
                        compute_metrics, customers_csv, generate_customers, run_simulation, time_series)
from simulation.validation import mmc_theory, run_mm1_validation

from . import charts
from .models import SimulationRun, StrategyComparison
from .params import meta


class BadRequest(Exception):
    pass


# Runs carry the whole event trace, so they are sent without optional whitespace.
COMPACT = {"separators": (",", ":")}


def api_view(func):
    """Turn invalid input into a 400 JSON error with a readable message."""

    @wraps(func)
    def wrapper(request, *args, **kwargs):
        try:
            return func(request, *args, **kwargs)
        except (BadRequest, ValueError, TypeError) as exc:
            return JsonResponse({"error": str(exc) or "invalid request"}, status=400)

    return wrapper


def _body(request) -> dict:
    try:
        data = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise BadRequest("request body must be valid JSON") from None
    if not isinstance(data, dict):
        raise BadRequest("request body must be a JSON object")
    return data


def _config(data: dict) -> SimulationConfig:
    params = dict(SimulationConfig().to_dict())
    supplied = data.get("parameters") or {}
    if not isinstance(supplied, dict):
        raise BadRequest("parameters must be a JSON object")
    params.update(supplied)
    return SimulationConfig.from_dict(params)


def _png(content: bytes) -> HttpResponse:
    return HttpResponse(content, content_type="image/png")


def _csv(text: str, filename: str) -> HttpResponse:
    response = HttpResponse(text, content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _comparison_results(cfg: SimulationConfig, reps: int) -> dict:
    results = compare_strategies(cfg, reps)
    # Replication 1 time series for each strategy, on identical customers
    customers = generate_customers(cfg)
    results["timeseries"] = {k: time_series(run_simulation(cfg, k, customers)) for k in STRATEGIES}
    return results


# ----------------------------------------------- upgrading stored results
# Runs are deterministic (seed + parameters), so a result saved by an older
# version of the engine is simply re-computed in the current format.
def _upgrade_run(run: SimulationRun) -> SimulationRun:
    if run.metrics.get("schema") == RESULT_SCHEMA:
        return run
    result = run_simulation(SimulationConfig.from_dict(run.parameters), run.strategy, record_decisions=True)
    run.metrics = compute_metrics(result)
    run.timeseries = time_series(result)
    run.trace = build_trace(result) if len(result.customers) <= settings.SIM_MAX_TRACE_CUSTOMERS else None
    run.save(update_fields=["metrics", "timeseries", "trace"])
    return run


def _upgrade_comparison(comparison: StrategyComparison) -> StrategyComparison:
    if comparison.results.get("schema") == RESULT_SCHEMA:
        return comparison
    cfg = SimulationConfig.from_dict(comparison.parameters)
    comparison.results = _comparison_results(cfg, comparison.replications)
    comparison.save(update_fields=["results"])
    return comparison


# ----------------------------------------------------------------- meta
@require_GET
def meta_view(request):
    return JsonResponse(meta())


# ----------------------------------------------------------------- runs
def _run_payload(run: SimulationRun) -> dict:
    return {**run.summary(), "parameters": run.parameters, "metrics": run.metrics,
            "timeseries": run.timeseries, "trace": run.trace}


@csrf_exempt
@require_http_methods(["GET", "POST"])
@api_view
def runs_view(request):
    if request.method == "GET":
        return JsonResponse({"results": [r.summary() for r in SimulationRun.objects.all()[:200]]})

    data = _body(request)
    strategy = data.get("strategy", "shortest_queue")
    if strategy not in STRATEGIES:
        raise BadRequest(f"strategy must be one of {', '.join(STRATEGIES)}")
    cfg = _config(data)
    if cfg.arrival_rate * cfg.duration > settings.SIM_MAX_EXPECTED_CUSTOMERS:
        raise BadRequest("this run would generate too many customers: arrival rate x run length must be "
                         f"at most {settings.SIM_MAX_EXPECTED_CUSTOMERS}")

    result = run_simulation(cfg, strategy, record_decisions=True)
    trace = build_trace(result) if len(result.customers) <= settings.SIM_MAX_TRACE_CUSTOMERS else None
    run = SimulationRun.objects.create(
        strategy=strategy, parameters=cfg.to_dict(), metrics=compute_metrics(result),
        timeseries=time_series(result), trace=trace,
    )
    return JsonResponse(_run_payload(run), status=201, json_dumps_params=COMPACT)


@csrf_exempt
@require_http_methods(["GET", "DELETE"])
def run_detail_view(request, pk: int):
    run = get_object_or_404(SimulationRun, pk=pk)
    if request.method == "DELETE":
        run.delete()
        return HttpResponse(status=204)
    return JsonResponse(_run_payload(_upgrade_run(run)), json_dumps_params=COMPACT)


@require_GET
def run_chart_view(request, pk: int, name: str):
    run = get_object_or_404(SimulationRun, pk=pk)
    if name not in charts.RUN_CHARTS:
        return JsonResponse({"error": f"unknown chart '{name}'"}, status=404)
    return _png(charts.RUN_CHARTS[name](_upgrade_run(run)))


@require_GET
def run_csv_view(request, pk: int):
    """Re-runs the stored configuration (deterministic) and exports every customer."""
    run = get_object_or_404(SimulationRun, pk=pk)
    result = run_simulation(SimulationConfig.from_dict(run.parameters), run.strategy)
    return _csv(customers_csv(result), f"run-{run.pk}-customers.csv")


# ---------------------------------------------------------- comparisons
def _comparison_payload(comparison: StrategyComparison) -> dict:
    return {**comparison.summary(), "parameters": comparison.parameters, "results": comparison.results}


@csrf_exempt
@require_http_methods(["GET", "POST"])
@api_view
def comparisons_view(request):
    if request.method == "GET":
        return JsonResponse({"results": [c.summary() for c in StrategyComparison.objects.all()[:200]]})

    data = _body(request)
    cfg = _config(data)
    try:
        reps = int(data.get("replications", 10))
    except (TypeError, ValueError):
        raise BadRequest("replications must be a whole number") from None
    if not 2 <= reps <= 100:
        raise BadRequest("replications must be between 2 and 100")
    work = cfg.arrival_rate * cfg.duration * reps * len(STRATEGIES)
    if work > settings.SIM_MAX_COMPARISON_WORK:
        raise BadRequest("too much work for one request: reduce replications, run length or arrival rate "
                         f"(arrival rate x run length x replications x 3 must be at most "
                         f"{settings.SIM_MAX_COMPARISON_WORK})")

    comparison = StrategyComparison.objects.create(
        parameters=cfg.to_dict(), replications=reps, results=_comparison_results(cfg, reps))
    return JsonResponse(_comparison_payload(comparison), status=201)


@csrf_exempt
@require_http_methods(["GET", "DELETE"])
def comparison_detail_view(request, pk: int):
    comparison = get_object_or_404(StrategyComparison, pk=pk)
    if request.method == "DELETE":
        comparison.delete()
        return HttpResponse(status=204)
    return JsonResponse(_comparison_payload(_upgrade_comparison(comparison)))


@require_GET
def comparison_chart_view(request, pk: int, name: str):
    comparison = get_object_or_404(StrategyComparison, pk=pk)
    if name not in charts.COMPARISON_CHARTS:
        return JsonResponse({"error": f"unknown chart '{name}'"}, status=404)
    return _png(charts.COMPARISON_CHARTS[name](_upgrade_comparison(comparison)))


@require_GET
def comparison_csv_view(request, pk: int):
    """One row per replication and strategy - the raw data behind the confidence intervals."""
    comparison = _upgrade_comparison(get_object_or_404(StrategyComparison, pk=pk))
    res = comparison.results
    seeds = res.get("seeds") or [comparison.parameters["seed"] + r for r in range(comparison.replications)]
    rows = []
    for key, runs in res["per_replication"].items():
        for r, values in enumerate(runs):
            rows.append({"replication": r + 1, "seed": seeds[r], "strategy": key,
                         "strategy_label": res["summary"][key]["label"], **values})
    buf = io.StringIO()
    pd.DataFrame(rows).round(6).to_csv(buf, index=False)
    return _csv(buf.getvalue(), f"comparison-{comparison.pk}-replications.csv")


# ----------------------------------------------------------- validation
@require_GET
@api_view
def validation_view(request):
    lam = float(request.GET.get("lambda", 0.7))
    mu = float(request.GET.get("mu", 1.0))
    if not 0 < lam < mu <= 5:
        raise BadRequest("the queue must be stable: choose 0 < lambda < mu <= 5")
    result = run_mm1_validation(lam=lam, mu=mu, duration=20_000, replications=10)
    result["mmc_reference"] = {"c": 2, "lambda": 2 * lam, "mu": mu, **mmc_theory(2 * lam, mu, 2)}
    return JsonResponse(result)
