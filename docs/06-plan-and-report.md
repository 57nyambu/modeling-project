# Two-Week Plan, Report and Presentation (Stages 8–10)

## Two-week plan

The code base is complete; the two weeks are for understanding it, running the
experiments, and writing up. Split the group by layer so everyone owns a part.

| Day | Work | Output |
|---|---|---|
| 1 | Everyone installs and runs the project (README). Read docs 01–03 together | All machines working |
| 2 | Walk through `customers.py`, `engine.py`, `strategies.py`. Re-do the hand-worked example on paper | Each member can explain one event handler |
| 3 | Walk through `metrics.py` and formulas (doc 03 section 3.6) | Formula sheet for the report |
| 4 | Run the test suite; run M/M/1 validation; record results | Validation section draft |
| 5 | Experiment 1: default settings, 10–20 replications, all strategies | Comparison table and charts |
| 6 | Experiment 2: arrival rate 1.0, 1.4, 1.8 | Sensitivity table |
| 7 | Experiment 3: express counters 1 vs 2 (4 counters total) | Express analysis |
| 8 | Experiment 4: 3 vs 4 vs 5 counters | Staffing analysis |
| 9 | Write report chapters 1–4 | Draft |
| 10 | Write report chapters 5–7, insert charts (download PNGs from the app) | Full draft |
| 11 | Review report against the brief; fix gaps | Final report |
| 12 | Build slides; plan live demo | Slides |
| 13 | Rehearse presentation and demo (each member presents their part) | Rehearsed |
| 14 | Buffer | Submit |

## Suggested experiments

| # | Question | Change | Keep |
|---|---|---|---|
| 1 | Which strategy is best at normal load? | Strategy | Defaults |
| 2 | How does the ranking change with busier stores? | arrival_rate 1.0 / 1.4 / 1.8 | 4 counters, 1 express |
| 3 | Is express checkout worth it if staffed properly? | num_express 1 / 2 | 4 counters |
| 4 | How many cashiers are needed for average wait < 1 min? | num_counters 3 / 4 / 5 | Best strategy |

Use the **Compare strategies** tab with at least 10 replications, and report
means with 95% confidence intervals.

## Report outline

1. **Introduction** — problem, objectives, scope (doc 01)
2. **Literature / background** — DES, queueing theory, Poisson process,
   Little's Law, Common Random Numbers
3. **Conceptual model** — entities, attributes, resources, activities, events,
   state variables, flow diagram (doc 02)
4. **Mathematical model** — distributions, assumptions, decision rules,
   performance formulas (doc 03)
5. **Implementation** — architecture, engine design, event handling, UI and
   replay visualisation (doc 04), screenshots
6. **Verification and validation** — tests, hand-worked example, M/M/1 check (doc 05)
7. **Experiments and results** — tables and charts from the app, interpretation
8. **Conclusions and recommendations** — which strategy, how many counters,
   limitations (assumptions 1–9) and future work (peak hours, balking,
   self-checkout, jockeying)

## Presentation outline (10–15 minutes)

1. Problem and objectives (1 slide)
2. Why simulation, what DES is (1 slide)
3. Conceptual model diagram (1 slide)
4. Distributions and assumptions (1 slide)
5. Architecture and how the animation replays the engine (1 slide)
6. **Live demo**: run a simulation, pause/resume, show live state and results
7. Validation table (1 slide)
8. Strategy comparison results with CIs (2 slides)
9. Recommendations and limitations (1 slide)
