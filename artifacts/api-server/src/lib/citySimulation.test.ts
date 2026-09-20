import { describe, expect, it } from "vitest";
import { advanceSimulationDay, applyGridAction, createCitySimulation, recalculate } from "./citySimulation";

describe("city simulation", () => {
  it("starts with a connected road spine and stable empty economy", () => {
    const city = createCitySimulation();
    expect(Object.values(city.cells).filter((cell) => cell.kind === "road").length).toBeGreaterThan(3);
    expect(city.population).toBe(0);
    expect(city.daily.net).toBeLessThan(0);
  });

  it("requires zoning to touch a road and charges a declared cost", () => {
    const city = createCitySimulation();
    expect(() => applyGridAction(city, { tool: "residential", x: 9, y: 0 })).toThrow("Zones must touch a road");
    const result = applyGridAction(city, { tool: "residential", x: 2, y: 3 });
    expect(result.cost).toBe(12);
    expect(result.state.cells["2:3"]).toMatchObject({ kind: "zone", zone: "residential" });
  });

  it("develops zoned land deterministically and recalculates employment and utilities", () => {
    let city = createCitySimulation();
    city = applyGridAction(city, { tool: "residential", x: 2, y: 3 }).state;
    city = advanceSimulationDay(city, 4);
    expect(city.cells["2:3"]?.kind).toBe("building");
    expect(city.population).toBeGreaterThan(0);
    expect(city.power.demand).toBeGreaterThan(0);
  });

  it("utility buildings supply real capacity", () => {
    let city = createCitySimulation();
    city = applyGridAction(city, { tool: "special", building: "powerPlant", x: 2, y: 3 }).state;
    city = applyGridAction(city, { tool: "special", building: "waterTower", x: 4, y: 3 }).state;
    expect(city.power.capacity).toBe(120);
    expect(city.water.capacity).toBe(120);
  });

  it("employment, income, maintenance and happiness derive from actual cells", () => {
    const city = createCitySimulation();
    const state = recalculate({ ...city, cells: {
      ...city.cells,
      "2:3": { kind: "building", building: "house", level: 1, condition: 100 },
      "4:3": { kind: "building", building: "shop", level: 1, condition: 100 },
      "3:3": { kind: "building", building: "powerPlant", level: 1, condition: 100 },
      "5:3": { kind: "building", building: "waterTower", level: 1, condition: 100 },
    } });
    expect(state.population).toBe(8);
    expect(state.employed).toBe(8);
    expect(state.daily.income).toBeGreaterThan(0);
    expect(state.daily.maintenance).toBeGreaterThan(0);
    expect(state.happiness).toBeGreaterThan(50);
  });

  it("repairs damaged buildings and clears active incidents", () => {
    const city = createCitySimulation();
    const damaged = recalculate({ ...city, cells: { ...city.cells, "2:3": { kind: "building", building: "house", condition: 45, incident: "fire" } } });
    const repaired = applyGridAction(damaged, { tool: "repair", x: 2, y: 3 });
    expect(repaired.state.cells["2:3"]).toMatchObject({ condition: 100 });
    expect(repaired.state.cells["2:3"]?.incident).toBeUndefined();
    expect(repaired.cost).toBeGreaterThan(5);
  });

  it("bulldozing updates all dependent statistics", () => {
    let city = createCitySimulation();
    city = applyGridAction(city, { tool: "special", building: "powerPlant", x: 2, y: 3 }).state;
    expect(city.power.capacity).toBe(120);
    city = applyGridAction(city, { tool: "bulldoze", x: 2, y: 3 }).state;
    expect(city.power.capacity).toBe(0);
    expect(city.cells["2:3"]).toBeUndefined();
  });
});
