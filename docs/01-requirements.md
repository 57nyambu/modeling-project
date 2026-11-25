# Stage 1 — Requirements Analysis

## 1.1 Problem statement

A supermarket manager wants to know how the way customers choose a checkout
counter affects waiting times, queue lengths and cashier workload. Experimenting
on a real store is slow, expensive and disruptive, so we build a **Discrete-Event
Simulation (DES)** model of the store and run experiments on the model instead.

This is a simulation model, **not** a supermarket management system. There is no
stock control, no product catalogue and no user accounts. Everything in the
application exists to generate, run, visualise and analyse simulation results.

## 1.2 Objectives

1. Model customers from entry, through four shopping sections, to checkout and exit.
2. Generate random arrivals, basket sizes, shopping times and service times from
   stated probability distributions.
3. Model multiple checkout counters, each with its own FIFO queue.
4. Implement and compare three counter-selection strategies under identical
   customer streams (Common Random Numbers).
5. Compute standard performance measures with correct formulas.
6. Present the model through a web application: dashboard, 2D animated layout,
   controls, parameters, charts and a strategy comparison.

## 1.3 Scope

| In scope | Out of scope |
|---|---|
| Customer arrivals, movement between sections, shopping, queueing, service, departure | Inventory, prices, product catalogue |
| 4 sections: Grocery, Beverages, Household, Personal Care | Staff scheduling / shift changes |
| 1–10 checkout counters, configurable number of express counters | Self-checkout machines |
| 3 counter-selection strategies | Queue switching (jockeying), balking, reneging (see assumptions) |
| Performance measures, replications, confidence intervals | Real-time data from a real store |

## 1.4 Functional requirements

| ID | Requirement |
|---|---|
| FR1 | The system shall generate customer arrivals as a Poisson process with a user-set rate. |
| FR2 | Each customer shall receive a basket category (Small 1–5, Medium 6–15, Large 16+) and an item count. |
| FR3 | Customers shall visit the sections that contain their items, in store-route order, spending a random time per item. |
| FR4 | Customers shall walk between locations along the store's walkways (aisles, cross-aisles and the main aisle), never through shelving; walking time = route length / walking speed. |
| FR5 | On reaching the checkout area, a customer shall pick a counter using the selected strategy and join its FIFO queue. |
| FR6 | Service time shall depend on the number of items (scanning) plus a random payment time. |
| FR7 | The system shall implement Shortest Queue, Shortest Estimated Waiting Time and Express/Normal strategies. |
| FR8 | Strategy comparisons shall use identical customer streams (same seed, same pre-generated customers). |
| FR9 | The system shall compute all measures listed in section 1.6. |
| FR10 | The user shall set parameters, choose a strategy, and Start, Pause, Resume and Reset the visual run. |
| FR11 | The application shall show a 2D store layout with moving customers (person figures) and visible queues, and let the user trace one customer's route, timeline and counter choice. |
| FR12 | The application shall show performance charts and a three-strategy comparison dashboard. |
| FR13 | Completed runs and comparisons shall be stored in SQLite and be retrievable. |

## 1.5 Non-functional requirements

- **Accuracy first:** formulas documented and tested; the engine is validated
  against queueing theory (M/M/1 and M/M/c).
- **Reproducibility:** every run is driven by a seed; the same seed and parameters
  give the same results.
- **Separation:** the simulation engine is a plain Python package with no Django
  imports, so it can be run and tested on its own.
- **Achievable in two weeks** with a group of students using Python and React.
- Runs on Windows (PowerShell commands provided).

## 1.6 Required performance measures

- Total customers generated and served
- Average and maximum waiting time in queue
- Average and maximum queue length
- Average checkout service time
- Average time spent in the supermarket
- Cashier utilisation (per counter and overall)
- Customers remaining in the system when the simulation ends

## 1.7 Users

- **Students / analysts** run experiments and compare strategies.
- **Lecturer / examiner** reviews the model, results and validation.

## 1.8 Constraints

- Language: Python (engine and API). React is used only for the browser interface.
- Permitted libraries: Django, NumPy, Pandas, Matplotlib, SQLite (built into Python).
- Deadline: two weeks.
