# Supermarket Customer Movement, Queue and Checkout Simulation

A Discrete-Event Simulation (DES) of customers entering a supermarket, shopping
in four sections, choosing a checkout counter, queueing, paying and leaving. It
compares three checkout strategies under identical customer streams.

- `api/` — Python simulation engine (`api/simulation`) and Django API (`api/simulator`)
- `web/` — React + TypeScript interface (dashboard, 2D animated store, comparison)
- `docs/` — requirements, conceptual model, mathematical model, architecture,
  testing and validation, plan and report outline

## Requirements

- Python 3.10 or newer
- Node.js 20 or newer

## Setup on Windows (PowerShell)

### 1. API (terminal 1)

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

If PowerShell blocks the activate script, run this once, then activate again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

The API is now at http://127.0.0.1:8000/api/meta

### 2. Web interface (terminal 2)

```powershell
cd web
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to Django, so both
servers must be running.

## Using the application

- **Simulation** — set parameters, choose a strategy, press **Start simulation**.
  The run is computed by the engine, stored in SQLite and replayed on the store
  layout. Use Pause, Resume, Reset, End, the speed selector and the time slider.
  Results, counter tables, Matplotlib charts and a CSV export appear below.
- **Compare strategies** — runs all three strategies for R replications on the
  same customers and shows means with 95% confidence intervals, paired
  differences and charts.
- **History** — reopen or delete stored runs and comparisons.
- **Validation** — reproduces M/M/1 queueing theory to validate the engine.

## Engine without the web interface

```powershell
cd api
python -m simulation.cli --strategy shortest_queue --seed 42
python -m simulation.cli --strategy express --csv customers.csv
python -m simulation.cli --compare --replications 10
python -m simulation.cli --validate
```

Strategies: `shortest_queue`, `shortest_wait`, `express`.

## Tests

```powershell
cd api
python -m unittest discover -s simulation/tests -t . -v
python manage.py test simulator
```

## Documentation

| Stage | Document |
|---|---|
| 1. Requirements analysis | [docs/01-requirements.md](docs/01-requirements.md) |
| 2. Conceptual modelling | [docs/02-conceptual-model.md](docs/02-conceptual-model.md) |
| 3. Mathematical modelling and assumptions | [docs/03-mathematical-model.md](docs/03-mathematical-model.md) |
| 4. Architecture and setup | [docs/04-architecture.md](docs/04-architecture.md) |
| 5–8. Engine, strategies, interface, analysis | Code in `api/` and `web/` |
| 9. Testing and validation | [docs/05-testing-validation.md](docs/05-testing-validation.md) |
| 10. Plan, report and presentation | [docs/06-plan-and-report.md](docs/06-plan-and-report.md) |
