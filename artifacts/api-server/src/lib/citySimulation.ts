export type ZoneKind = "residential" | "commercial" | "industrial";
export type CityTool = "road" | ZoneKind | "bulldoze" | "repair";
export type CellKind = "road" | "zone" | "building";
export type IncidentKind = "fire" | "virus" | "earthquake" | "flood" | "robbery" | "asteroid" | "ufo";

export interface SimCell {
  kind: CellKind;
  zone?: ZoneKind;
  building?: string;
  level?: number;
  condition?: number;
  incident?: IncidentKind;
  age?: number;
  stressDays?: number;
  abandoned?: boolean;
  residents?: number;
  employees?: number;
  landValue?: number;
}

export interface CityLog {
  day: number;
  tone: "good" | "neutral" | "danger";
  message: string;
}

export interface CitySimulation {
  version: 1;
  width: number;
  height: number;
  day: number;
  cells: Record<string, SimCell>;
  population: number;
  jobs: number;
  employed: number;
  vacancies: number;
  happiness: number;
  power: { capacity: number; demand: number };
  water: { capacity: number; demand: number };
  daily: { income: number; maintenance: number; net: number };
  demand: { residential: number; commercial: number; industrial: number };
  environment: { landValue: number; pollution: number; congestion: number; roadAccess: number };
  coverage: { fire: number; health: number; police: number };
  abandonedBuildings: number;
  disastersSurvived: number;
  logs: CityLog[];
}

interface BuildingSpec {
  id: string;
  name: string;
  zone: ZoneKind | "service" | "utility";
  icon: string;
  population: number;
  jobs: number;
  powerGenerated: number;
  powerConsumed: number;
  waterGenerated: number;
  waterConsumed: number;
  revenue: number;
  maintenance: number;
  happiness: number;
  service?: "fire" | "health" | "police" | "education" | "park";
  pollution?: number;
}

export const SIM_BUILDINGS: Record<string, BuildingSpec> = {
  house: { id: "house", name: "Family House", zone: "residential", icon: "🏠", population: 8, jobs: 0, powerGenerated: 0, powerConsumed: 3, waterGenerated: 0, waterConsumed: 3, revenue: 2, maintenance: 1, happiness: 2 },
  apartments: { id: "apartments", name: "Apartments", zone: "residential", icon: "🏢", population: 24, jobs: 2, powerGenerated: 0, powerConsumed: 8, waterGenerated: 0, waterConsumed: 9, revenue: 7, maintenance: 3, happiness: 0 },
  shop: { id: "shop", name: "Local Shops", zone: "commercial", icon: "🏪", population: 0, jobs: 12, powerGenerated: 0, powerConsumed: 5, waterGenerated: 0, waterConsumed: 2, revenue: 15, maintenance: 3, happiness: 2 },
  office: { id: "office", name: "Office", zone: "commercial", icon: "🏬", population: 0, jobs: 28, powerGenerated: 0, powerConsumed: 10, waterGenerated: 0, waterConsumed: 3, revenue: 32, maintenance: 7, happiness: 0 },
  factory: { id: "factory", name: "Factory", zone: "industrial", icon: "🏭", population: 0, jobs: 22, powerGenerated: 2, powerConsumed: 9, waterGenerated: 0, waterConsumed: 7, revenue: 26, maintenance: 6, happiness: -3 },
  warehouse: { id: "warehouse", name: "Warehouse", zone: "industrial", icon: "🏚️", population: 0, jobs: 14, powerGenerated: 0, powerConsumed: 5, waterGenerated: 0, waterConsumed: 2, revenue: 18, maintenance: 4, happiness: -1 },
  powerPlant: { id: "powerPlant", name: "Power Plant", zone: "utility", icon: "⚡", population: 0, jobs: 8, powerGenerated: 120, powerConsumed: 0, waterGenerated: 0, waterConsumed: 5, revenue: 0, maintenance: 12, happiness: -4 },
  waterTower: { id: "waterTower", name: "Water Tower", zone: "utility", icon: "💧", population: 0, jobs: 4, powerGenerated: 0, powerConsumed: 3, waterGenerated: 120, waterConsumed: 0, revenue: 0, maintenance: 8, happiness: 1 },
  fireStation: { id: "fireStation", name: "Fire Station", zone: "service", icon: "🚒", population: 0, jobs: 10, powerGenerated: 0, powerConsumed: 5, waterGenerated: 0, waterConsumed: 4, revenue: 0, maintenance: 10, happiness: 4, service: "fire" },
  hospital: { id: "hospital", name: "Hospital", zone: "service", icon: "🏥", population: 0, jobs: 18, powerGenerated: 0, powerConsumed: 8, waterGenerated: 0, waterConsumed: 7, revenue: 0, maintenance: 15, happiness: 6, service: "health" },
  police: { id: "police", name: "Police Station", zone: "service", icon: "🚓", population: 0, jobs: 12, powerGenerated: 0, powerConsumed: 5, waterGenerated: 0, waterConsumed: 3, revenue: 0, maintenance: 11, happiness: 4, service: "police" },
  school: { id: "school", name: "Focus Academy", zone: "service", icon: "🏫", population: 0, jobs: 14, powerGenerated: 0, powerConsumed: 6, waterGenerated: 0, waterConsumed: 4, revenue: 0, maintenance: 12, happiness: 5, service: "education" },
  park: { id: "park", name: "City Park", zone: "service", icon: "🌳", population: 0, jobs: 2, powerGenerated: 0, powerConsumed: 1, waterGenerated: 0, waterConsumed: 3, revenue: 0, maintenance: 4, happiness: 9, service: "park", pollution: -10 },
};

export const TOOL_COSTS: Record<CityTool, number> = { road: 8, residential: 12, commercial: 14, industrial: 14, bulldoze: 3, repair: 5 };
export const SPECIAL_COSTS: Record<string, number> = { powerPlant: 220, waterTower: 180, fireStation: 260, hospital: 320, police: 280, school: 240, park: 75 };

const key = (x: number, y: number) => `${x}:${y}`;
const parseKey = (value: string) => value.split(":").map(Number) as [number, number];

export function createCitySimulation(width = 10, height = 8): CitySimulation {
  const cells: Record<string, SimCell> = {};
  const midY = Math.floor(height / 2);
  for (let x = 1; x < Math.min(width - 1, 6); x += 1) cells[key(x, midY)] = { kind: "road" };
  cells[key(3, midY - 1)] = { kind: "road" };
  return recalculate({
    version: 1, width, height, day: 0, cells, population: 0, jobs: 0, employed: 0, vacancies: 0,
    happiness: 50, power: { capacity: 0, demand: 0 }, water: { capacity: 0, demand: 0 },
    daily: { income: 0, maintenance: 0, net: 0 }, demand: { residential: 1, commercial: 0, industrial: 0 },
    environment: { landValue: 50, pollution: 0, congestion: 0, roadAccess: 100 }, coverage: { fire: 0, health: 0, police: 0 },
    abandonedBuildings: 0, disastersSurvived: 0,
    logs: [{ day: 0, tone: "good", message: "Your first roads are ready. Zone land beside them to welcome citizens." }],
  });
}

function neighbours(state: CitySimulation, x: number, y: number) {
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < state.width && ny < state.height)
    .map(([nx, ny]) => ({ x: nx, y: ny, cell: state.cells[key(nx, ny)] }));
}

function hasRoad(state: CitySimulation, x: number, y: number) {
  return neighbours(state, x, y).some(({ cell }) => cell?.kind === "road");
}

function adjacentRoadKeys(state: CitySimulation, plotKey: string): string[] {
  const [x, y] = parseKey(plotKey);
  return neighbours(state, x, y).filter(({ cell }) => cell?.kind === "road").map(({ x: nx, y: ny }) => key(nx, ny));
}

/** Shortest network distance between two roadside properties. Services do not
 * teleport: disconnected roads intentionally return Infinity. */
function roadDistance(state: CitySimulation, from: string, to: string): number {
  const starts = adjacentRoadKeys(state, from);
  const goals = new Set(adjacentRoadKeys(state, to));
  if (!starts.length || !goals.size) return Infinity;
  const queue = starts.map((road) => ({ road, distance: 0 }));
  const visited = new Set(starts);
  while (queue.length) {
    const current = queue.shift()!;
    if (goals.has(current.road)) return current.distance;
    const [x, y] = parseKey(current.road);
    for (const next of neighbours(state, x, y)) {
      const nextKey = key(next.x, next.y);
      if (next.cell?.kind === "road" && !visited.has(nextKey)) {
        visited.add(nextKey); queue.push({ road: nextKey, distance: current.distance + 1 });
      }
    }
  }
  return Infinity;
}

function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }

export function recalculate(state: CitySimulation): CitySimulation {
  let population = 0, jobs = 0, powerCapacity = 0, powerDemand = 0, waterCapacity = 0, waterDemand = 0, income = 0, maintenance = 0, happinessEffect = 0, pollutionPoints = 0;
  const cells = { ...state.cells };
  const properties = Object.entries(cells).filter(([, cell]) => cell.kind === "building" && !!cell.building);
  const roads = Object.values(cells).filter((cell) => cell.kind === "road").length;
  const services = properties.filter(([, cell]) => !!SIM_BUILDINGS[cell.building!]?.service);
  let roadAccessible = 0;

  for (const [plotKey, cell] of properties) {
    const spec = SIM_BUILDINGS[cell.building!];
    if (!spec) continue;
    const level = Math.max(1, cell.level ?? 1);
    const condition = Math.max(0, Math.min(100, cell.condition ?? 100)) / 100;
    const active = !cell.abandoned && condition > 0;
    const maxResidents = spec.population * level;
    const maxJobs = spec.jobs * level;
    const residents = active ? Math.min(maxResidents, Math.max(0, cell.residents ?? maxResidents)) : 0;
    if (hasRoad(state, ...parseKey(plotKey))) roadAccessible += 1;
    population += residents;
    if (active) jobs += maxJobs;
    powerCapacity += active ? spec.powerGenerated * level : 0;
    powerDemand += active ? spec.powerConsumed * level : 0;
    waterCapacity += active ? spec.waterGenerated * level : 0;
    waterDemand += active ? spec.waterConsumed * level : 0;
    maintenance += spec.maintenance * level;
    happinessEffect += active ? spec.happiness : -2;
    pollutionPoints += active ? (spec.pollution ?? (spec.zone === "industrial" ? 7 : spec.id === "powerPlant" ? 14 : 0)) * level : 0;
    cells[plotKey] = { ...cell, residents };
  }
  maintenance += roads;
  const employed = Math.min(population, jobs);
  const vacancies = Math.max(0, jobs - employed);
  const employmentFillRate = jobs ? employed / jobs : 1;
  for (const [plotKey, cell] of properties) {
    const spec = SIM_BUILDINGS[cell.building!];
    if (!spec) continue;
    const maxJobs = cell.abandoned ? 0 : spec.jobs * Math.max(1, cell.level ?? 1);
    const employees = Math.min(maxJobs, Math.round(maxJobs * employmentFillRate));
    const condition = Math.max(0, Math.min(100, cell.condition ?? 100)) / 100;
    cells[plotKey] = { ...cells[plotKey]!, employees };
    if (!cell.abandoned && maxJobs > 0) income += Math.floor(spec.revenue * (employees / maxJobs) * Math.max(1, cell.level ?? 1) * condition);
  }

  const unemploymentRate = population ? (population - employed) / population : 0;
  const jobShortfall = Math.max(0, population - jobs);
  const workerShortfall = Math.max(0, jobs - population);
  const demand = population === 0
    ? { residential: 1, commercial: 0, industrial: 0 }
    : {
      residential: clamp01(.1 + workerShortfall / Math.max(20, population) - unemploymentRate * .7),
      commercial: clamp01(.1 + jobShortfall / Math.max(20, population) * .55 + Math.max(0, population / 80 - jobs / 120)),
      industrial: clamp01(.1 + jobShortfall / Math.max(20, population) * .45),
    };

  const congestion = clamp01(employed / Math.max(1, roads * 10));
  const pollution = clamp01(pollutionPoints / Math.max(20, properties.length * 12));
  const coverageFor = (service: "fire" | "health" | "police") => {
    const sources = services.filter(([plotKey, cell]) => {
      const spec = SIM_BUILDINGS[cell.building!];
      const requiredStaff = Math.ceil((spec?.jobs ?? 0) * Math.max(1, cell.level ?? 1) * .5);
      return spec?.service === service && (cells[plotKey]?.employees ?? 0) >= requiredStaff;
    });
    const targets = properties.filter(([, cell]) => !SIM_BUILDINGS[cell.building!]?.service);
    if (!targets.length || !sources.length) return 0;
    return Math.round(targets.filter(([target]) => sources.some(([source]) => roadDistance(state, source, target) <= 8)).length / targets.length * 100);
  };
  const coverage = { fire: coverageFor("fire"), health: coverageFor("health"), police: coverageFor("police") };
  const avgCoverage = (coverage.fire + coverage.health + coverage.police) / 3;
  const parkCount = services.filter(([, cell]) => SIM_BUILDINGS[cell.building!]?.service === "park").length;
  const landValue = Math.max(0, Math.min(100, Math.round(45 + avgCoverage * .25 + parkCount * 5 - pollution * 30 - congestion * 18)));
  for (const [plotKey] of properties) cells[plotKey] = { ...cells[plotKey]!, landValue };

  const utilityPenalty = (powerCapacity < powerDemand ? 20 : 0) + (waterCapacity < waterDemand ? 20 : 0);
  const unemploymentPenalty = Math.round(unemploymentRate * 24);
  const happiness = Math.max(0, Math.min(100, Math.round(52 + happinessEffect + avgCoverage * .12 + landValue * .12 - utilityPenalty - unemploymentPenalty - congestion * 16 - pollution * 12)));
  const powerHealth = powerDemand ? Math.min(1, powerCapacity / powerDemand) : 1;
  const waterHealth = waterDemand ? Math.min(1, waterCapacity / waterDemand) : 1;
  income = Math.floor(income * (happiness / 100) * powerHealth * waterHealth);
  return { ...state, cells, population, jobs, employed, vacancies, happiness,
    power: { capacity: powerCapacity, demand: powerDemand }, water: { capacity: waterCapacity, demand: waterDemand },
    daily: { income, maintenance, net: income - maintenance }, demand,
    environment: { landValue, pollution: Math.round(pollution * 100), congestion: Math.round(congestion * 100), roadAccess: properties.length ? Math.round(roadAccessible / properties.length * 100) : 100 },
    coverage, abandonedBuildings: properties.filter(([, cell]) => cell.abandoned).length };
}

export function applyGridAction(state: CitySimulation, action: { tool: CityTool | "special"; x: number; y: number; building?: string }): { state: CitySimulation; cost: number; message: string } {
  const { x, y } = action;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= state.width || y >= state.height) throw new Error("Invalid city plot");
  const plotKey = key(x, y);
  const current = state.cells[plotKey];
  const cells = { ...state.cells };
  let cost: number;
  let message: string;
  if (action.tool === "bulldoze") {
    if (!current) throw new Error("There is nothing to bulldoze");
    delete cells[plotKey]; cost = TOOL_COSTS.bulldoze; message = "Plot cleared";
  } else if (action.tool === "repair") {
    if (current?.kind !== "building" || ((current.condition ?? 100) >= 100 && !current.incident)) throw new Error("That building does not need repairs");
    cost = Math.max(TOOL_COSTS.repair, Math.ceil((100 - (current.condition ?? 100)) / 2));
    cells[plotKey] = { ...current, condition: 100, incident: undefined }; message = "Building fully repaired";
  } else if (action.tool === "road") {
    if (current) throw new Error("That plot is occupied");
    cells[plotKey] = { kind: "road" }; cost = TOOL_COSTS.road; message = "Road connected";
  } else if (action.tool === "special") {
    if (current) throw new Error("That plot is occupied");
    const spec = action.building ? SIM_BUILDINGS[action.building] : undefined;
    if (!spec || (spec.zone !== "service" && spec.zone !== "utility")) throw new Error("Unknown service building");
    if (!hasRoad(state, x, y)) throw new Error("Service buildings must touch a road");
    cells[plotKey] = { kind: "building", building: spec.id, level: 1, condition: 100 };
    cost = SPECIAL_COSTS[spec.id] ?? 250; message = `${spec.name} opened`;
  } else {
    if (current) throw new Error("That plot is occupied");
    if (!hasRoad(state, x, y)) throw new Error("Zones must touch a road");
    cells[plotKey] = { kind: "zone", zone: action.tool }; cost = TOOL_COSTS[action.tool]; message = `${action.tool} zone created`;
  }
  return { state: recalculate({ ...state, cells, logs: [{ day: state.day, tone: "neutral" as const, message }, ...state.logs].slice(0, 30) }), cost, message };
}

function random(seed: number) {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

export function advanceSimulationDay(input: CitySimulation, seed = 1): CitySimulation {
  const state = recalculate(input);
  const day = state.day + 1;
  const rng = random(seed + state.day * 7919 + state.population * 31);
  const cells = { ...state.cells };
  const logs = [...state.logs];
  const powerHealth = state.power.demand ? Math.min(1, state.power.capacity / state.power.demand) : 1;
  const waterHealth = state.water.demand ? Math.min(1, state.water.capacity / state.water.demand) : 1;
  const utilitiesHealthy = powerHealth >= .85 && waterHealth >= .85;

  // Zone development follows actual R/C/I demand. Low-density starters can
  // operate off-grid; high-density variants require healthy city utilities.
  const zones = Object.entries(cells).filter(([, cell]) => cell.kind === "zone" && cell.zone);
  for (const [plotKey, cell] of zones) {
    const zone = cell.zone!;
    const pressure = state.demand?.[zone] ?? (zone === "residential" ? 1 : 0);
    if (pressure <= 0 || rng() > .18 + pressure * .62) continue;
    const dense = utilitiesHealthy && state.environment.landValue >= 58 && rng() < .35;
    const building = zone === "residential" ? (dense ? "apartments" : "house") : zone === "commercial" ? (dense ? "office" : "shop") : (dense ? "warehouse" : "factory");
    const spec = SIM_BUILDINGS[building]!;
    cells[plotKey] = { kind: "building", building, level: 1, condition: 100, age: 0, stressDays: 0, residents: spec.population ? Math.max(1, Math.ceil(spec.population * .6)) : 0, employees: 0, abandoned: false };
    logs.unshift({ day, tone: "good", message: `${spec.name} completed construction as ${zone} demand reached ${Math.round(pressure * 100)}%.` });
    break;
  }

  // Every property can grow, stabilize, decline, become abandoned, recover,
  // or finally collapse back into its original zone.
  for (const [plotKey, original] of Object.entries(cells)) {
    if (original.kind !== "building" || !original.building) continue;
    const spec = SIM_BUILDINGS[original.building];
    if (!spec) continue;
    const level = Math.max(1, original.level ?? 1);
    const maxResidents = spec.population * level;
    const maxJobs = spec.jobs * level;
    const employeeRatio = maxJobs ? (original.employees ?? 0) / maxJobs : 1;
    const zone = spec.zone === "residential" || spec.zone === "commercial" || spec.zone === "industrial" ? spec.zone : null;
    const utilityStress = spec.zone === "commercial" ? powerHealth < .5 : spec.zone === "industrial" ? powerHealth < .7 || waterHealth < .7 : spec.zone === "residential" ? state.happiness < 20 || powerHealth < .45 || waterHealth < .45 : false;
    const laborStress = spec.zone === "commercial" ? employeeRatio <= .2 : spec.zone === "industrial" ? employeeRatio <= .05 : false;
    const stressed = utilityStress || laborStress || (original.condition ?? 100) < 35 || !hasRoad(state, ...parseKey(plotKey));
    const stressDays = stressed ? (original.stressDays ?? 0) + 1 : Math.max(0, (original.stressDays ?? 0) - 1);
    let residents = original.residents ?? maxResidents;
    if (spec.population) {
      if (!stressed && state.happiness >= 45 && residents < maxResidents) residents += Math.max(1, Math.ceil(maxResidents * .12));
      if (state.happiness < 35 || utilityStress) residents -= Math.max(1, Math.ceil(maxResidents * .16));
      residents = Math.max(0, Math.min(maxResidents, residents));
    }
    let next: SimCell = { ...original, age: (original.age ?? 0) + 1, stressDays, residents, condition: Math.max(1, (original.condition ?? 100) - (day % 12 === 0 ? 1 : 0)) };

    if (original.abandoned) {
      if (!stressed && state.environment.landValue >= 42 && rng() < .4) {
        next = { ...next, abandoned: false, stressDays: 0, residents: spec.population ? Math.max(1, Math.ceil(maxResidents * .35)) : 0 };
        logs.unshift({ day, tone: "good", message: `${spec.name} was reoccupied after local conditions recovered.` });
      } else if (stressDays >= 7 && zone) {
        cells[plotKey] = { kind: "zone", zone };
        logs.unshift({ day, tone: "danger", message: `The abandoned ${spec.name} was demolished. Its ${zone} zoning remains.` });
        continue;
      }
    } else if (stressDays >= (laborStress ? 7 : 3)) {
      next = { ...next, abandoned: true, residents: 0, employees: 0 };
      logs.unshift({ day, tone: "danger", message: `${spec.name} was abandoned after ${stressDays} stressed days.` });
    } else if (zone && level > 1 && (original.landValue ?? state.environment.landValue) < 42 + level * 7 && stressDays >= 2) {
      next = { ...next, level: level - 1, stressDays: 0, residents: Math.min(residents, spec.population * (level - 1)) };
      logs.unshift({ day, tone: "danger", message: `${spec.name} fell to level ${level - 1} as land value declined.` });
    } else if (zone && level < 3 && (next.age ?? 0) >= level * 3 && !stressed) {
      const demand = state.demand?.[zone] ?? 0;
      const requiredLandValue = 48 + level * 10;
      const serviceCoverage = (state.coverage.fire + state.coverage.health + state.coverage.police) / 3;
      if (demand >= .2 && state.environment.landValue >= requiredLandValue && (level === 1 || serviceCoverage >= 25) && rng() < .2 + demand * .25) {
        next = { ...next, level: level + 1, age: 0, residents: spec.population ? Math.max(residents, spec.population * level) : 0 };
        logs.unshift({ day, tone: "good", message: `${spec.name} grew to level ${level + 1}; demand, services and land value supported expansion.` });
      }
    }
    cells[plotKey] = next;
  }

  let disastersSurvived = state.disastersSurvived;
  const buildings = Object.entries(cells).filter(([, cell]) => cell.kind === "building" && !cell.abandoned);
  if (state.day >= 3 && buildings.length && rng() < Math.min(.35, .08 + state.day / 800)) {
    const incidents: IncidentKind[] = state.day > 200 ? ["fire", "virus", "earthquake", "robbery", "flood", "ufo", "asteroid"] : state.day > 100 ? ["fire", "virus", "earthquake", "robbery", "flood", "ufo"] : ["fire", "virus", "earthquake", "robbery"];
    const incident = incidents[Math.floor(rng() * incidents.length)]!;
    const [plotKey, victim] = buildings[Math.floor(rng() * buildings.length)]!;
    const requiredService = incident === "fire" ? "fire" : incident === "virus" ? "health" : incident === "robbery" ? "police" : null;
    const serviceSources = requiredService ? buildings.filter(([, cell]) => SIM_BUILDINGS[cell.building!]?.service === requiredService) : [];
    const protectedIncident = serviceSources.some(([source]) => roadDistance(state, source, plotKey) <= 8);
    if (protectedIncident) {
      logs.unshift({ day, tone: "good", message: `${incident} response succeeded over the road network; emergency services protected ${SIM_BUILDINGS[victim.building!]?.name}.` });
      disastersSurvived += 1;
    } else {
      const damage = incident === "asteroid" ? 65 : incident === "earthquake" || incident === "ufo" ? 35 : 20;
      const condition = Math.max(0, (victim.condition ?? 100) - damage);
      if (condition === 0) delete cells[plotKey]; else cells[plotKey] = { ...victim, condition, incident, stressDays: (victim.stressDays ?? 0) + 1 };
      // Uncontained fires may spread to one adjacent property.
      if (incident === "fire" && rng() < .3) {
        const [x, y] = parseKey(plotKey);
        const target = neighbours(state, x, y).find(({ cell }) => cell?.kind === "building" && !cell.incident);
        if (target) cells[key(target.x, target.y)] = { ...target.cell!, incident: "fire", condition: Math.max(1, (target.cell!.condition ?? 100) - 15) };
      }
      logs.unshift({ day, tone: "danger", message: `${incident} damaged ${victim.building ? SIM_BUILDINGS[victim.building]?.name : "a building"}. Reachable emergency services would reduce future losses.` });
    }
  }
  return recalculate({ ...state, day, cells, disastersSurvived, logs: logs.slice(0, 30) });
}

export function clearResolvedIncidents(state: CitySimulation): CitySimulation {
  return { ...state, cells: Object.fromEntries(Object.entries(state.cells).map(([plotKey, cell]) => [plotKey, cell.incident ? { ...cell, incident: undefined } : cell])) };
}

export function coordinates(plotKey: string) { const [x, y] = parseKey(plotKey); return { x, y }; }
