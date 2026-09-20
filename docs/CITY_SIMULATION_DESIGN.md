# Focus City simulation design

## Purpose

Focus City is a persistent productivity-linked city simulation, not a detached
client-side minigame. Construction spends the authenticated user's real Focus
Coins through the audited coin ledger. City state is server-authoritative in
PostgreSQL. A verified focus session advances one city day, while the city
produces bounded, collectable citizen revenue.

## Research basis

The implementation was checked against these city-simulation designs:

- **Capital Chaos / PocketCity** (`Sol4rOnGit/PocketCity`) — grid roads,
  roadside R/C/I generation, utilities, employment, low-happiness demolition,
  employer shutdown, path-based emergency response, inflation, disasters, and
  service dispatch. Licensed FBX assets used by FocusArx are documented in
  `CITY_ASSET_PROVENANCE.md`.
- **Cimulity** (`zeikar/cimulity`, MIT) — labor-derived R/C/I demand,
  dead-banded demand, structure capacity, road-propagated service coverage,
  traffic pressure, land-value growth gates, abandonment and reoccupation.
- **IsoCity** (`amilich/isometric-city`, MIT) — browser-oriented simulation
  boundaries, city KPIs, service budgets, pollution, happiness, and responsive
  isometric interaction.

FocusArx has its own server simulation and account/economy integration. The
research informed behavior and invariants; it is not a drop-in copy of another
project's client state.

## Daily simulation order

Every city day executes deterministically from persisted state and a stable
seed:

1. Recalculate capacities and current operating health.
2. Calculate labor demand from residents, jobs, employees, and vacancies.
3. Develop at most one eligible zoned lot according to R/C/I demand.
4. Update every property's age, occupancy, staffing, physical condition, and
   consecutive stress days.
5. Evaluate growth, decline, abandonment, reoccupation, or demolition.
6. Roll an era-appropriate incident and resolve it through the road network.
7. Recalculate utilities, coverage, pollution, congestion, land value,
   happiness, revenue, upkeep, and net revenue.
8. Persist the complete result atomically.

A completed focus session invokes the same day engine. Manual day advancement
exists for active play but never directly mints wallet coins.

## Growth and decline

### Zoned development

A zone must touch a road. Residential, commercial, and industrial development
uses separate demand values in the range 0–1.

- **Residential demand** rises when jobs exceed available workers and falls
  when unemployment is high.
- **Commercial demand** rises with a worker surplus and unmet retail demand.
- **Industrial demand** rises with a worker surplus and external-market pull.
- A city with no labor market starts with residential demand so an empty city
  is not a deadlocked state.

Low-density starter buildings can develop before municipal utilities are
complete. Dense variants require healthy power and water plus sufficient land
value.

### Occupancy

Residential occupancy moves toward capacity when happiness and utilities are
healthy. Residents leave when happiness or utility availability is poor. Job
occupancy is constrained by the actual workforce; income is based on staffed
jobs rather than theoretical job capacity.

### Level growth

A property can grow from level 1 to level 3 only when all applicable gates are
satisfied:

- minimum building age;
- positive demand for its zone;
- healthy utilities;
- road access;
- a rising land-value threshold for each level;
- service coverage for higher-density growth;
- no active operational stress.

Higher levels add real population or job capacity and utility demand. They are
not cosmetic.

### Falling, abandonment, and recovery

Each building tracks consecutive stress days. Stress includes:

- residential happiness below 20%;
- severe power or water shortage;
- commercial staffing at or below 20%;
- industrial staffing at or below 5%;
- industrial utility health below 70%;
- commercial power health below 50%;
- no road access;
- severe structural damage.

Utility and residential failures can abandon a property after three days.
Labor-starved employers receive a seven-day window. A higher-level property can
fall one level when land value cannot support its density. An abandoned
property can be reoccupied when roads, utilities, and land value recover. If it
remains stressed for seven days, the structure is removed while the original
zoning remains, allowing redevelopment instead of permanently destroying the
player's plan.

## Utilities

Every operating building contributes generation and demand. The simulation
tracks power and water independently. Shortage ratios affect:

- happiness;
- business productivity and tax income;
- development density;
- building stress and shutdown;
- residential move-in and move-out.

Abandoned buildings stop producing capacity and stop consuming operating
utilities, but continue to incur a small ownership cost until recovered or
removed.

## Roads, services, and coverage

Road adjacency is required for zoning and civic construction. Emergency
coverage is not a global boolean. The simulation runs breadth-first search over
connected road tiles and limits effective response to eight road steps.

- Fire stations contain fire.
- Hospitals resolve virus incidents.
- Police stations resolve robbery.
- Disconnected services provide no protection.
- Uncontained fire can spread to an adjacent property.

Coverage percentages report the actual share of eligible properties reachable
from each service network.

## Land value and environment

Land value combines:

- fire, health, and police coverage;
- park availability;
- pollution;
- congestion.

Industrial properties and power plants produce pollution. Parks reduce it.
Congestion is derived from employed commuters relative to road capacity. Both
pollution and congestion reduce happiness and land value, indirectly limiting
density and increasing decline risk.

## Economy and anti-cheat boundaries

- Construction, zoning, repair, and demolition spend coins through
  `burnCoins`, inside a transaction holding a row lock on the city.
- Citizen collection uses `mintCoins` and a locked tax timestamp, preventing
  double collection from multiple tabs.
- Revenue storage is capped at 24 hours.
- Operating revenue uses staffed jobs, condition, happiness, power health, and
  water health.
- Maintenance includes buildings and every road tile.
- Only the server computes costs, development, disasters, and rewards.
- The browser sends intent (`tool`, coordinates, optional building), never a
  claimed result or reward amount.

## Rendering and accessibility

The default renderer uses React Three Fiber and licensed FBX models. The map
renderer remains a fully interactive fallback for reduced capability and
keyboard-oriented interaction. Both consume the same server state and invoke
the same endpoints, so switching views cannot fork progress.
