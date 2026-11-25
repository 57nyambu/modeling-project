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
   state variables (doc 02; diagrams 3 to 5: entities, process flow, life cycle)
4. **Mathematical model** — distributions, assumptions, decision rules,
   performance formulas (doc 03; diagrams 9 to 13)
5. **Implementation** — architecture, engine design, event handling, UI and
   replay visualisation (doc 04; diagrams 6 to 8, 14 and 15), screenshots
6. **Verification and validation** — tests, hand-worked example, M/M/1 check (doc 05)
7. **Experiments and results** — tables and charts from the app, interpretation
8. **Conclusions and recommendations** — which strategy, how many counters,
   limitations (assumptions 1–9) and future work (balking, reneging,
   self-checkout, jockeying, staff breaks)

Every diagram on the **How the model works** page has SVG and PNG download
buttons, and every chart has a Matplotlib PNG link, so all report figures come
straight from the app. The SVG files are also in `docs/diagrams/`
(see `docs/07-diagrams.md`).

## Presentation outline (10–15 minutes)

The **How the model works** page doubles as the slide deck: press **Present**
and use the arrow keys. For the demo, start Django in single-server mode
(`npm run build` once, then `python manage.py runserver`) so only one window is needed.

1. Problem and objectives (1 slide)
2. Why simulation, what DES is: diagram 7, next-event time advance
3. The store and one customer's journey: diagrams 1 and 4
4. Conceptual model: diagrams 3 and 6
5. Distributions and assumptions: diagram 10
6. Strategies: diagram 9, where all three choose a different counter
7. **Live demo**: run a simulation, pause, scrub to the busiest moment, resume
8. Validation: diagram 16 and the Validation page
9. Strategy comparison results with confidence intervals (Compare strategies page)
10. Recommendations and limitations (1 slide)
