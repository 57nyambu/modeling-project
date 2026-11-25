# Stage 4 — System Architecture

Diagrams 14 and 15 on the app's **How the model works** page draw this chapter.

## 4.1 Overview

```
modeling-project/
├── api/                      Python: simulation engine + Django API
│   ├── simulation/           Pure-Python DES engine (NO Django imports)
│   │   ├── config.py         All parameters (SimulationConfig) + validation, lambda(t)
│   │   ├── layout.py         Store geometry in metres (shared with the UI)
│   │   ├── customers.py      All random sampling; pre-generates customers (CRN), thinning
│   │   ├── strategies.py     Shortest Queue, Shortest Estimated Wait, Express/Normal
│   │   ├── engine.py         Event list, clock, event handlers, counters, step series
│   │   ├── metrics.py        Performance measures (Pandas), time series, animation trace, CSV
│   │   ├── comparison.py     Replications, 95% CIs, paired differences
│   │   ├── validation.py     M/M/1 and M/M/c (Erlang C) checks
│   │   ├── cli.py            Command-line runner
│   │   └── tests/            Engine unit tests
│   ├── simulator/            Django app: models, JSON views, Matplotlib charts
│   ├── config/               Django project settings and URLs (also serves the built web app)
│   └── requirements.txt
├── web/                      React + TypeScript (Vite, Mantine components, IBM Plex type)
│   └── src/
│       ├── api.ts            Typed API client
│       ├── model.ts          Client copy of the formulas: input checks, load check, densities
│       ├── router.ts         Hash routes such as #/simulation/12 and #/model/event-graph
│       ├── theme.ts          Design tokens and Mantine theme
│       ├── sim/              Floor plan, playback clock, trace interpolation, timeline scrubber
│       ├── charts/           Hand-built SVG charts with tooltips and table views
│       ├── diagrams/         The 17 model diagrams and their descriptions
│       ├── components/       App shell pieces, parameter panel, customer log
│       └── pages/            Simulation, Compare, How the model works, Validation, Saved results
└── docs/                     Stage documents and exported diagrams
```

## 4.2 Layers and responsibilities

| Layer | Technology | Responsibility |
|---|---|---|
| Simulation engine | Python, NumPy, Pandas | The model. Generates customers, runs events, computes measures. |
| API | Django + SQLite | Validates input, calls the engine, stores runs, draws report figures with Matplotlib. |
| Interface | React + TypeScript | Parameters, controls, floor-plan replay, interactive charts, diagrams. |

The engine is independent: `python -m simulation.cli` runs it with no Django at
all, and its tests run with plain `unittest`. Django only *calls* it.

## 4.3 How the visualisation integrates with Django

A DES does not run in "real time": the engine jumps from event to event and
finishes a 4-hour trading day in well under a second. So the visualisation is a
**replay** of the finished run, not a second simulation:

1. **Start** — React sends `POST /api/runs` with the parameters and strategy.
2. Django calls `run_simulation(config, strategy)`. The engine records every
   customer's event times: arrival, arrival and departure at each section,
   checkout arrival, chosen counter, service start, departure. It also records
   every change of the queue lengths, the number waiting, the busy cashiers and
   the customers in the store.
3. Django stores the run in SQLite and returns the measures, the step series and
   a compact **trace** (those event times plus the store layout).
4. React's playback clock advances simulated time at the chosen speed. For each
   frame it computes where each customer is at time *t*:
   - before the arrival time: not yet in the store;
   - between two known points: walking (straight-line interpolation);
   - inside a section between its arrival and departure: shopping in an aisle;
   - between checkout arrival and service start: in the queue, placed in FIFO order;
   - between service start and departure: at the till.
5. **Pause / Resume / Reset / the timeline scrubber** only move the playback
   clock. Every position comes from engine event times, so the animation cannot
   disagree with the statistics. The charts show a dark playhead at the same time.

**Why not Pygame?** Pygame opens a desktop window; it cannot be embedded in a
web page. Using it would mean a second, separate interface. The browser canvas
does the same 2D drawing inside the React app, driven by the same engine output.

**Charts.** The app draws interactive SVG charts in the browser (hover for
values, a table view for every chart). Matplotlib draws the same charts as
report-ready PNG files on the server; every chart card has a PNG link.

## 4.4 API endpoints

| Method | URL | Purpose |
|---|---|---|
| GET | `/api/meta` | Defaults, parameter limits and help text, strategies, store layout |
| GET/POST | `/api/runs` | List runs / run one strategy and store it |
| GET/DELETE | `/api/runs/<id>` | Full run (measures, step series, trace) / delete |
| GET | `/api/runs/<id>/customers.csv` | Per-customer data (re-generated from the stored seed) |
| GET | `/api/runs/<id>/charts/<name>.png` | `queue-length`, `in-store`, `busy-cashiers`, `wait-histogram`, `utilisation` |
| GET/POST | `/api/comparisons` | List / run all three strategies with R replications |
| GET/DELETE | `/api/comparisons/<id>` | Full comparison / delete |
| GET | `/api/comparisons/<id>/replications.csv` | One row per replication and strategy |
| GET | `/api/comparisons/<id>/charts/<name>.png` | `avg-wait`, `p90-wait`, `max-wait`, `queue-length`, `time-in-store`, `utilisation`, `by-category`, `queue-over-time`, `replications` |
| GET | `/api/validation?lambda=0.7&mu=1` | M/M/1 validation with 10 replications |

Invalid input returns HTTP 400 with a readable message, for example
`{"error": "basket probabilities must sum to 1"}`.

## 4.5 Data storage (SQLite)

| Table | Fields |
|---|---|
| `SimulationRun` | created_at, strategy, parameters (JSON), metrics (JSON), timeseries (JSON), trace (JSON) |
| `StrategyComparison` | created_at, parameters (JSON), replications, results (JSON) |

Parameters include the seed, so any stored run can be reproduced exactly. Stored
results carry a `schema` number; when a run saved by an older version of the
engine is opened, Django re-runs it from its seed and parameters and saves it in
the current format, so old databases keep working.

## 4.6 Development and request flow

In development two servers run: Django on port 8000 and Vite on port 5173. Vite
forwards every `/api/...` request to Django, so the browser sees a single origin
and no CORS package is needed.

**Single-server mode** (for a demo or the presentation): run `npm run build` in
`web/` once, then start only Django. It serves the built interface at
`http://127.0.0.1:8000/` alongside the API.
