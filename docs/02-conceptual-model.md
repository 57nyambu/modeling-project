# Stage 2 — Conceptual Model

A conceptual model describes *what* we simulate before we write code. In DES we
describe the system with **entities**, **attributes**, **resources**,
**activities**, **events** and **state variables**.

## 2.1 Key ideas in plain language

- **Entity** — something that moves through the system. Here: a customer.
- **Attribute** — a property of an entity. Example: a customer's basket size.
- **Resource** — something entities compete for. Here: checkout counters (cashiers).
- **Activity** — something that takes time. Example: scanning items.
- **Event** — an instant where the system state changes. Example: a customer
  finishes paying. Time in a DES *jumps* from one event to the next; nothing
  changes between events, so nothing needs to be computed there.
- **State variable** — a value describing the system at a moment. Example:
  number of people waiting at counter 2.

## 2.2 System diagram

```
            +-------------------- SUPERMARKET --------------------+
            |  [Grocery]   [Beverages]   [Household]  [Personal]  |
 ENTRANCE ->|      \            |            |           /        |
            |       +-------> walk to checkout area <---+         |
            |                       |                             |
            |         strategy chooses a counter                  |
            |    Q1 |||   Q2 |||   Q3 |||   Q4 |||  (FIFO queues) |
            |    [C1]     [C2]     [C3]     [C4]    (cashiers)    |
            +---------------------------------------------> EXIT  |
```

## 2.3 Entities and attributes

**Customer**

| Attribute | Type | Meaning |
|---|---|---|
| `id` | int | Unique identifier |
| `arrival_time` | minutes | Time the customer enters |
| `basket_category` | Small / Medium / Large | Basket size class |
| `items` | int | Number of items |
| `items_per_section` | dict | How many items are taken from each section |
| `route` | list | Sections visited, in store-route order |
| `walking_speed` | m/s | Personal walking speed |
| `pick_time` per section | minutes | Time spent selecting items in each section |
| `service_time` | minutes | Time the cashier needs for this customer |
| `counter` | int | Counter chosen at checkout |
| `queue_join_time`, `service_start_time`, `departure_time` | minutes | Recorded timestamps |

`service_time` is a property of the customer (it depends on their items and how
they pay), not of the counter. This is what lets every strategy face exactly the
same workload.

## 2.4 Resources

**Checkout counter** (capacity 1 cashier each)

| Attribute | Meaning |
|---|---|
| `id` | Counter number |
| `type` | `normal` or `express` (express only matters for Strategy 3) |
| `queue` | FIFO list of waiting customers |
| `current_customer` | Customer being served, or none |
| `busy_until` | Time the current service ends |
| `busy_time` | Accumulated busy time (for utilisation) |

Shopping sections are **not** capacity-limited resources: many customers can
shop at once (an infinite-server stage).

## 2.5 Activities (things that take time)

| Activity | Duration |
|---|---|
| Walk entrance → first section, section → section, last section → checkout | distance / walking speed |
| Shop in a section | sum of per-item pick times |
| Wait in queue | determined by the model (output, not input) |
| Checkout service | scan time × items + payment time |

## 2.6 Events

| Event | What happens | Events it schedules |
|---|---|---|
| `ARRIVAL` | Customer enters; counted as generated | `SECTION_ARRIVE` (first section) |
| `SECTION_ARRIVE` | Customer starts shopping in a section | `SECTION_DEPART` |
| `SECTION_DEPART` | Customer finishes a section | next `SECTION_ARRIVE`, or `CHECKOUT_ARRIVE` |
| `CHECKOUT_ARRIVE` | Strategy chooses a counter; customer joins its queue. If the counter is idle, service starts immediately | `SERVICE_END` (if service starts) |
| `SERVICE_END` | Customer pays and leaves; counter takes the next customer in its queue | `SERVICE_END` for the next customer |
| `END` | Simulation clock reaches the run length | — |

## 2.7 State variables

| Variable | Meaning |
|---|---|
| `clock` | Current simulation time |
| `Q_c(t)` | Number waiting in counter *c*'s queue (excluding the person being served) |
| `B_c(t)` | 1 if counter *c* is busy, else 0 |
| `N_shop(t)` | Customers currently shopping or walking |
| `N_sys(t)` | Customers in the store |
| Counters | generated, served |

## 2.8 Logic flow for one customer

```
ARRIVAL
  -> walk to first section on route
  -> for each section on route: shop (pick items), then walk to next
  -> walk to checkout area
CHECKOUT_ARRIVE
  -> strategy picks counter c
  -> if counter c idle and queue empty: start service now
     else: join end of queue c
SERVICE_END
  -> record departure; counter starts next customer in queue (FIFO)
```

## 2.9 Checkout strategies

1. **Shortest Queue (SQ)** — choose the counter with the fewest customers
   (waiting + being served). Ties go to the lowest counter number.
2. **Shortest Estimated Waiting Time (SEWT)** — choose the counter whose
   predicted wait is smallest. The customer can see basket sizes but not exact
   service times, so the prediction uses the **expected** service time of each
   waiting customer plus the expected remaining time of the person being served.
3. **Express / Normal (EXP)** — customers with ≤ 5 items must use an express
   counter; customers with > 5 items must use a normal counter. Inside its
   group, the customer picks the shortest queue. If there are no express
   counters, everyone uses normal counters.

No customer changes queue after joining (no jockeying).
