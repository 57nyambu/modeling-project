# Stage 4 — System Architecture

## 4.1 Overview

```
modeling-project/
├── api/                     Python: simulation engine + Django API
│   ├── simulation/          Pure-Python DES engine (NO Django imports)
│   │   ├── config.py        All parameters (SimulationConfig) + validation
│   │   ├── layout.py        Store geometry in metres (shared with the UI)
│   │   ├── customers.py     All random sampling; pre-generates customers (CRN)
│   │   ├── strategies.py    Shortest Queue, Shortest Estimated Wait, Express/Normal
│   │   ├── engine.py        Event list, clock, event handlers, counters
│   │   ├── metrics.py       Performance measures (Pandas), time series, animation trace
│   │   ├── comparison.py    Replications, 95% CIs, paired differences
│   │   ├── validation.py    M/M/1 and M/M/c (Erlang C) checks
│   │   ├── cli.py           Command-line runner
│   │   └── tests/           Engine unit tests
│   ├── simulator/           Django app: models, JSON views, Matplotlib charts
│   ├── config/              Django project settings and URLs
│   └── requirements.txt
├── web/                     React + TypeScript (Vite, Mantine components)
│   └── src/
│       ├── api.ts           Typed API client
│       ├── sim/             Playback clock, trace interpolation, canvas renderer
│       ├── pages/           Simulation, Compare, History, Validation
│       └── components/      Parameter panel, stat cards, chart images
└── docs/                    Stage documents (this folder)
```

## 4.2 Layers and responsibilities

| Layer | Technology | Responsibility |
|---|---|---|
| Simulation engine | Python, NumPy, Pandas | The model. Generates customers, runs events, computes measures. |
| API | Django + SQLite | Validates input, calls the engine, stores runs, renders charts (Matplotlib). |
| Interface | React + TypeScript | Parameter forms, controls, 2D animation, dashboards. |

The engine is independent: `python -m simulation.cli` runs it with no Django at
all, and its tests run with plain `unittest`. Django only *calls* it.

## 4.3 How the visualisation integrates with Django

A DES does not run in "real time": the engine jumps from event to event and
finishes a 4-hour trading day in well under a second. So the visualisation is a
**replay** of the finished run, not a second simulation:

1. **Start** — React sends `POST /api/runs` with the parameters and strategy.
2. Django calls `run_simulation(config, strategy)`. The engine records every
   customer's event times: arrival, arrival and departure at each section,
   checkout arrival, chosen counter, service start, departure.
3. Django stores the run in SQLite and returns the metrics, time series and a
   compact **trace** (those event times plus the store layout).
4. React's playback clock advances simulated time (speed set by the user). For
   each frame it computes where each customer is at time *t*:
   - before an event time → not yet arrived;
   - between two known points → walking (linear interpolation);
   - inside a section between its arrival and departure → shopping;
   - between checkout arrival and service start → in queue, placed in FIFO order;
   - between service start and departure → at the counter.
5. **Pause / Resume / Reset / scrub** only change the playback clock. Because
   every position comes from engine event times, the animation can never
   disagree with the computed statistics.

**Why not Pygame?** Pygame opens a desktop window; it cannot be embedded in a
web page. Using it would mean a second, separate interface. The browser canvas
does the same 2D drawing inside the React app, driven by the same engine output.

## 4.4 API endpoints

| Method | URL | Purpose |
|---|---|---|
| GET | `/api/meta` | Default parameters, parameter limits, strategies |
| GET/POST | `/api/runs` | List runs / run one strategy and store it |
| GET/DELETE | `/api/runs/<id>` | Full run (metrics, time series, trace) / delete |
| GET | `/api/runs/<id>/customers.csv` | Per-customer data (re-generated from the stored seed) |
| GET | `/api/runs/<id>/charts/<name>.png` | `queue-length`, `in-store`, `wait-histogram`, `utilisation` |
| GET/POST | `/api/comparisons` | List / run all three strategies with R replications |
| GET/DELETE | `/api/comparisons/<id>` | Full comparison / delete |
| GET | `/api/comparisons/<id>/charts/<name>.png` | `avg-wait`, `max-wait`, `queue-length`, `time-in-store`, `utilisation`, `by-category`, `queue-over-time` |
| GET | `/api/validation?lambda=0.7&mu=1` | M/M/1 validation with 10 replications |

## 4.5 Data storage (SQLite)

| Table | Fields |
|---|---|
| `SimulationRun` | created_at, strategy, parameters (JSON), metrics (JSON), timeseries (JSON), trace (JSON) |
| `StrategyComparison` | created_at, parameters (JSON), replications, results (JSON) |

Parameters include the seed, so any stored run can be reproduced exactly.

## 4.6 Development and request flow

In development two servers run: Django on port 8000 and Vite on port 5173. Vite
forwards every `/api/...` request to Django, so the browser sees a single origin
and no CORS package is needed.
