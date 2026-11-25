"""JSON API. The simulation engine (the `simulation` package) does the modelling;
these views only validate input, call the engine, store results and serve them.

CSRF is disabled on the JSON endpoints because this is a local, single-user
teaching application with no login. Do not expose it to the internet as-is.
"""

from __future__ import annotations

import json
from functools import wraps

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from simulation import (STRATEGIES, SimulationConfig, build_trace, compare_strategies, compute_metrics,
                        customers_dataframe, generate_customers, run_simulation, time_series)
from simulation.validation import mmc_theory, run_mm1_validation

from . import charts
from .models import SimulationRun, StrategyComparison
from .params import meta


class BadRequest(Exception):
    pass


def api_view(func):
    """Turn BadRequest/ValueError into a 400 JSON error."""

    @wraps(func)
    def wrapper(request, *args, **kwargs):
        try:
            return func(request, *args, **kwargs)
        except (BadRequest, ValueError) as exc:
            return JsonResponse({"error": str(exc)}, status=400)

    return wrapper


def _body(request) -> dict:
    try:
        data = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        raise BadRequest("request body must be valid JSON") from None
    if not isinstance(data, dict):
        raise BadRequest("request body must be a JSON object")
    return data


def _config(data: dict) -> SimulationConfig:
    params = dict(SimulationConfig().to_dict())
    params.update(data.get("parameters") or {})
    return SimulationConfig.from_dict(params)


def _png(content: bytes) -> HttpResponse:
    return HttpResponse(content, content_type="image/png")


# ----------------------------------------------------------------- meta
@require_GET
def meta_view(request):
    return JsonResponse(meta())


# ----------------------------------------------------------------- runs
def _run_payload(run: SimulationRun, include_trace: bool = True) -> dict:
    data = {**run.summary(), "parameters": run.parameters, "metrics": run.metrics, "timeseries": run.timeseries}
    if include_trace:
        data["trace"] = run.trace
    return data


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
        raise BadRequest(f"arrival_rate x duration must be at most {settings.SIM_MAX_EXPECTED_CUSTOMERS}")

    result = run_simulation(cfg, strategy)
    trace = build_trace(result) if len(result.customers) <= settings.SIM_MAX_TRACE_CUSTOMERS else None
    run = SimulationRun.objects.create(
        strategy=strategy, parameters=cfg.to_dict(), metrics=compute_metrics(result),
        timeseries=time_series(result), trace=trace,
    )
    return JsonResponse(_run_payload(run), status=201)


@csrf_exempt
@require_http_methods(["GET", "DELETE"])
def run_detail_view(request, pk: int):
    run = get_object_or_404(SimulationRun, pk=pk)
    if request.method == "DELETE":
        run.delete()
        return HttpResponse(status=204)
    return JsonResponse(_run_payload(run))


@require_GET
def run_chart_view(request, pk: int, name: str):
    run = get_object_or_404(SimulationRun, pk=pk)
    if name not in charts.RUN_CHARTS:
        return JsonResponse({"error": f"unknown chart '{name}'"}, status=404)
    return _png(charts.RUN_CHARTS[name](run))


@require_GET
def run_csv_view(request, pk: int):
    """Re-runs the stored configuration (deterministic) and exports every customer."""
    run = get_object_or_404(SimulationRun, pk=pk)
    result = run_simulation(SimulationConfig.from_dict(run.parameters), run.strategy)
    response = HttpResponse(customers_dataframe(result).to_csv(index=False), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="run-{run.pk}-customers.csv"'
    return response


# ---------------------------------------------------------- comparisons
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
        raise BadRequest("replications must be an integer") from None
    work = cfg.arrival_rate * cfg.duration * reps * len(STRATEGIES)
    if work > settings.SIM_MAX_COMPARISON_WORK:
        raise BadRequest("too much work: reduce replications, duration or arrival rate "
                         f"(lambda x T x replications x 3 must be at most {settings.SIM_MAX_COMPARISON_WORK})")

    results = compare_strategies(cfg, reps)
    # Replication 1 time series for each strategy, on identical customers
    customers = generate_customers(cfg)
    results["timeseries"] = {k: time_series(run_simulation(cfg, k, customers)) for k in STRATEGIES}
    comparison = StrategyComparison.objects.create(parameters=cfg.to_dict(), replications=reps, results=results)
    return JsonResponse({**comparison.summary(), "parameters": comparison.parameters,
                         "results": comparison.results}, status=201)


@csrf_exempt
@require_http_methods(["GET", "DELETE"])
def comparison_detail_view(request, pk: int):
    comparison = get_object_or_404(StrategyComparison, pk=pk)
    if request.method == "DELETE":
        comparison.delete()
        return HttpResponse(status=204)
    return JsonResponse({**comparison.summary(), "parameters": comparison.parameters,
                         "results": comparison.results})


@require_GET
def comparison_chart_view(request, pk: int, name: str):
    comparison = get_object_or_404(StrategyComparison, pk=pk)
    if name not in charts.COMPARISON_CHARTS:
        return JsonResponse({"error": f"unknown chart '{name}'"}, status=404)
    return _png(charts.COMPARISON_CHARTS[name](comparison))


# ----------------------------------------------------------- validation
@require_GET
@api_view
def validation_view(request):
    lam = float(request.GET.get("lambda", 0.7))
    mu = float(request.GET.get("mu", 1.0))
    if not 0 < lam < mu <= 5:
        raise BadRequest("need 0 < lambda < mu <= 5")
    result = run_mm1_validation(lam=lam, mu=mu, duration=20_000, replications=10)
    result["mmc_reference"] = {"c": 2, "lambda": 2 * lam, "mu": mu, **mmc_theory(2 * lam, mu, 2)}
    return JsonResponse(result)
