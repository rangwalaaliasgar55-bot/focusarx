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
  service?: "fire" | "health" | "police";
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
};

export const TOOL_COSTS: Record<CityTool, number> = { road: 8, residential: 12, commercial: 14, industrial: 14, bulldoze: 3, repair: 5 };
export const SPECIAL_COSTS: Record<string, number> = { powerPlant: 220, waterTower: 180, fireStation: 260, hospital: 320, police: 280 };

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
    daily: { income: 0, maintenance: 0, net: 0 }, disastersSurvived: 0,
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

export function recalculate(state: CitySimulation): CitySimulation {
  let population = 0, jobs = 0, powerCapacity = 0, powerDemand = 0, waterCapacity = 0, waterDemand = 0, income = 0, maintenance = 0, happinessEffect = 0;
  for (const cell of Object.values(state.cells)) {
    if (cell.kind === "road") { maintenance += 1; continue; }
    if (cell.kind !== "building" || !cell.building) continue;
    const spec = SIM_BUILDINGS[cell.building];
    if (!spec) continue;
    const level = Math.max(1, cell.level ?? 1);
    const condition = Math.max(0, Math.min(100, cell.condition ?? 100)) / 100;
    population += spec.population * level;
    jobs += spec.jobs * level;
    powerCapacity += spec.powerGenerated * level;
    powerDemand += spec.powerConsumed * level;
    waterCapacity += spec.waterGenerated * level;
    waterDemand += spec.waterConsumed * level;
    income += Math.floor(spec.revenue * level * condition);
    maintenance += spec.maintenance * level;
    happinessEffect += spec.happiness;
  }
  const utilityPenalty = (powerCapacity < powerDemand ? 20 : 0) + (waterCapacity < waterDemand ? 20 : 0);
  const employed = Math.min(population, jobs);
  const unemploymentPenalty = population ? Math.round(((population - employed) / population) * 20) : 0;
  const happiness = Math.max(0, Math.min(100, 55 + happinessEffect - utilityPenalty - unemploymentPenalty));
  const productivity = happiness / 100 * (powerCapacity >= powerDemand ? 1 : .55) * (waterCapacity >= waterDemand ? 1 : .55);
  income = Math.floor(income * productivity);
  return { ...state, population, jobs, employed, vacancies: Math.max(0, jobs - employed), happiness,
    power: { capacity: powerCapacity, demand: powerDemand }, water: { capacity: waterCapacity, demand: waterDemand },
    daily: { income, maintenance, net: income - maintenance } };
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
  const rng = random(seed + state.day * 7919 + state.population * 31);
  const cells = { ...state.cells };
  const logs = [...state.logs];
  // Zoned lots develop automatically when utilities and road access support growth.
  const zones = Object.entries(cells).filter(([, cell]) => cell.kind === "zone" && cell.zone);
  const developmentChance = state.power.capacity >= state.power.demand && state.water.capacity >= state.water.demand ? .72 : .3;
  for (const [plotKey, cell] of zones) {
    if (rng() > developmentChance) continue;
    const options = cell.zone === "residential" ? ["house", "apartments"] : cell.zone === "commercial" ? ["shop", "office"] : ["factory", "warehouse"];
    const building = options[Math.floor(rng() * options.length)]!;
    cells[plotKey] = { kind: "building", building, level: 1, condition: 100 };
    logs.unshift({ day: state.day + 1, tone: "good", message: `${SIM_BUILDINGS[building]!.name} completed construction.` });
    break;
  }
  // Existing buildings can grow after the city becomes healthy.
  const growable = Object.entries(cells).filter(([, cell]) => cell.kind === "building" && ["house", "shop", "factory"].includes(cell.building ?? "") && (cell.level ?? 1) < 3);
  if (state.happiness >= 65 && growable.length && rng() < .25) {
    const [plotKey, cell] = growable[Math.floor(rng() * growable.length)]!;
    cells[plotKey] = { ...cell, level: (cell.level ?? 1) + 1 };
    logs.unshift({ day: state.day + 1, tone: "good", message: `${SIM_BUILDINGS[cell.building!]!.name} upgraded as demand increased.` });
  }
  let disastersSurvived = state.disastersSurvived;
  const buildings = Object.entries(cells).filter(([, cell]) => cell.kind === "building");
  if (state.day >= 3 && buildings.length && rng() < Math.min(.35, .08 + state.day / 800)) {
    const incidents: IncidentKind[] = state.day > 100 ? ["fire", "virus", "earthquake", "robbery", "flood", "ufo"] : ["fire", "virus", "earthquake", "robbery"];
    const incident = incidents[Math.floor(rng() * incidents.length)]!;
    const [plotKey, victim] = buildings[Math.floor(rng() * buildings.length)]!;
    const services = Object.values(cells).map((cell) => cell.building ? SIM_BUILDINGS[cell.building] : undefined).filter(Boolean);
    const protectedIncident = (incident === "fire" && services.some((spec) => spec!.service === "fire")) || (incident === "virus" && services.some((spec) => spec!.service === "health")) || (incident === "robbery" && services.some((spec) => spec!.service === "police"));
    if (protectedIncident) {
      logs.unshift({ day: state.day + 1, tone: "good", message: `${incident} response succeeded; emergency services protected the district.` });
      disastersSurvived += 1;
    } else {
      const damage = incident === "earthquake" || incident === "ufo" ? 35 : 20;
      const condition = Math.max(0, (victim.condition ?? 100) - damage);
      if (condition === 0) delete cells[plotKey]; else cells[plotKey] = { ...victim, condition, incident };
      logs.unshift({ day: state.day + 1, tone: "danger", message: `${incident} damaged ${victim.building ? SIM_BUILDINGS[victim.building]?.name : "a building"}. Add emergency services to reduce future damage.` });
    }
  }
  return recalculate({ ...state, day: state.day + 1, cells, disastersSurvived, logs: logs.slice(0, 30) });
}

export function clearResolvedIncidents(state: CitySimulation): CitySimulation {
  return { ...state, cells: Object.fromEntries(Object.entries(state.cells).map(([plotKey, cell]) => [plotKey, cell.incident ? { ...cell, incident: undefined } : cell])) };
}

export function coordinates(plotKey: string) { const [x, y] = parseKey(plotKey); return { x, y }; }
