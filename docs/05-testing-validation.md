# Stage 9 — Testing and Validation

Two different questions:

- **Verification** — did we build the model right? (Does the code do what the
  conceptual and mathematical model say?)
- **Validation** — did we build the right model? (Does it behave like the real
  system, or like theory where theory is known?)

## 9.1 Verification tests (`api/simulation/tests/test_engine.py`)

| Test | What it proves |
|---|---|
| Hand-worked example | 3 customers, 1 counter: every timestamp, wait, queue area and utilisation matches a hand calculation |
| Cut-off at end | Customers still inside at T are counted as remaining; busy time is clipped to T |
| Reproducibility | Same seed and parameters give identical results |
| Common Random Numbers | All strategies receive identical customer lists |
| FIFO and single server | Each counter serves in join order and never serves two customers at once |
| Conservation | generated = served + shopping + waiting + in service |
| Time-weighted queue | ∫Q(t)dt equals the sum of individual waiting times inside [0, T] |
| Strategy rules | Express customers only at express counters; SQ and SEWT choose as specified |
| Statistics | Mean, standard deviation and t-based CI are correct |

Django API tests (`api/simulator/tests.py`) cover run creation, charts, CSV
export, comparisons and rejection of invalid input.

Run them (PowerShell, inside `api` with the virtual environment active):

```powershell
python -m unittest discover -s simulation/tests -t . -v
python manage.py test simulator
```

## 9.2 Validation against queueing theory

With one counter and exponential service, the checkout is an M/M/1 queue
(see section 3.8). 10 replications × 20,000 minutes, λ = 0.7, μ = 1.0:

| Measure | Theory | Simulated mean | 95% CI | Relative error |
|---|---|---|---|---|
| ρ | 0.7000 | 0.6986 | 0.6954 – 0.7017 | 0.20% |
| W_q (min) | 2.3333 | 2.2760 | 2.1863 – 2.3657 | 2.46% |
| L_q | 1.6333 | 1.5942 | 1.5292 – 1.6592 | 2.40% |

All three theoretical values lie inside the confidence intervals. The small
negative bias is expected: every replication starts with an empty store.

Reproduce: `python -m simulation.cli --validate`, or the **Validation** tab.

## 9.3 Face validity and sensitivity checks

Run these in the application and confirm the direction of change makes sense:

- Increase the arrival rate → waiting time and utilisation rise; near
  λ·E[S] ≈ number of counters, queues explode.
- Add a counter → waiting time falls, utilisation falls.
- Increase scan time per item → service time and waiting rise, large baskets most.
- Little's Law check on the dashboard: L_q equals λ_eff × W_q.

## 9.4 Results at default settings (seed 42, 10 replications)

| Strategy | Avg wait (min) | Max queue | Utilisation |
|---|---|---|---|
| Shortest Queue | 0.273 ± 0.030 | 2.10 ± 0.23 | 58.0% |
| Shortest Estimated Waiting Time | 0.226 ± 0.026 | 2.30 ± 0.35 | 58.0% |
| Express and Normal (1 express) | 1.471 ± 0.309 | 8.60 ± 2.34 | 57.9% |

SEWT is significantly better than SQ (paired difference −0.047 min, 95% CI
−0.059 to −0.035). With one express counter out of four, the express counter
receives 45% of customers (expected load 0.63 × 1.32 ≈ 0.83; 78% busy in the
seed-42 run), so small-basket customers wait about 3 minutes while normal
counters sit partly idle. With 2 express counters the express strategy's average
wait falls to 0.986 ± 0.184 min but is still worse than SQ and SEWT: splitting
cashiers into two separate pools loses the pooling benefit.
