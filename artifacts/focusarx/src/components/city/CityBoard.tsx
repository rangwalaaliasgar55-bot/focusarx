import { useMemo } from "react";
import { Building2, Check, Hand, Map as MapIcon, Move, Trees } from "lucide-react";
import type { Building } from "@/types/gamification";
import "./city-board.css";

type Plot = { x: number; y: number };

type Props = {
  buildings: Building[];
  owned: Record<string, boolean>;
  layout: Record<string, Plot>;
  selectedSlug: string | null;
  movingSlug: string | null;
  width?: number;
  height?: number;
  time: string;
  weather: string;
  busy: boolean;
  onSelect: (slug: string | null) => void;
  onMoveStart: (slug: string | null) => void;
  onPlace: (building: Building, plot: Plot) => void;
  onMove: (slug: string, plot: Plot) => void;
};

const TILE_W = 66;
const TILE_H = 34;

function buildingIcon(building: Building | undefined) {
  if (!building) return "🏠";
  return building.icon || ({ study: "📚", nature: "🌳", service: "🏥", commercial: "🏪", landmark: "🏛️" }[building.category] ?? "🏢");
}

export function CityBoard({
  buildings, owned, layout, selectedSlug, movingSlug, width = 10, height = 8,
  time, weather, busy, onSelect, onMoveStart, onPlace, onMove,
}: Props) {
  const bySlug = useMemo(() => new Map(buildings.map((item) => [item.slug, item])), [buildings]);
  // Cities created before the placement update still render immediately. Their
  // next move/build persists the explicit coordinates on the server.
  const effectiveLayout = useMemo(() => {
    const next = { ...layout };
    const taken = new Set(Object.values(next).map((plot) => `${plot.x}:${plot.y}`));
    for (const slug of Object.keys(owned).filter((key) => owned[key]).sort()) {
      if (next[slug]) continue;
      for (let index = 0; index < width * height; index += 1) {
        const plot = { x: index % width, y: Math.floor(index / width) };
        if (!taken.has(`${plot.x}:${plot.y}`)) { next[slug] = plot; taken.add(`${plot.x}:${plot.y}`); break; }
      }
    }
    return next;
  }, [height, layout, owned, width]);
  const occupied = useMemo(() => new Map(Object.entries(effectiveLayout).map(([slug, plot]) => [`${plot.x}:${plot.y}`, slug])), [effectiveLayout]);
  const selected = selectedSlug ? bySlug.get(selectedSlug) : undefined;
  const plots = Array.from({ length: width * height }, (_, index) => ({ x: index % width, y: Math.floor(index / width) }));
  const boardWidth = (width + height) * TILE_W / 2 + 90;
  const boardHeight = (width + height) * TILE_H / 2 + 150;

  const choosePlot = (plot: Plot) => {
    if (busy || occupied.has(`${plot.x}:${plot.y}`)) return;
    if (movingSlug) onMove(movingSlug, plot);
    else if (selected) onPlace(selected, plot);
  };

  return (
    <section className={`city-game city-game--${time} city-game--${weather}`} aria-label="Interactive city map">
      <div className="city-game__sky" aria-hidden="true">
        <span className="city-game__sun" />
        <span className="city-game__cloud city-game__cloud--one">☁</span>
        <span className="city-game__cloud city-game__cloud--two">☁</span>
      </div>
      <header className="city-game__toolbar">
        <div>
          <span className="city-game__eyebrow"><MapIcon size={12} /> LIVE DISTRICT</span>
          <h2>Build your focus capital</h2>
          <p>{movingSlug ? "Choose an empty plot to move your building." : selected ? `Choose a plot for ${selected.name}.` : "Select a property below, then choose its plot."}</p>
        </div>
        {(selectedSlug || movingSlug) && (
          <button type="button" onClick={() => { onSelect(null); onMoveStart(null); }} className="city-game__cancel">Cancel</button>
        )}
      </header>

      <div className="city-game__viewport">
        <div className="city-game__board" style={{ width: boardWidth, height: boardHeight }}>
          {plots.map((plot) => {
            const key = `${plot.x}:${plot.y}`;
            const slug = occupied.get(key);
            const definition = slug ? bySlug.get(slug) : undefined;
            const left = (plot.x - plot.y) * TILE_W / 2 + boardWidth / 2 - TILE_W / 2;
            const top = (plot.x + plot.y) * TILE_H / 2 + 34;
            const canPlace = !slug && !!(selected || movingSlug);
            const decorativeTree = !slug && !canPlace && ((plot.x * 7 + plot.y * 3) % 11 === 0);
            return (
              <button
                type="button"
                key={key}
                className={`city-plot ${slug ? "city-plot--occupied" : ""} ${canPlace ? "city-plot--available" : ""}`}
                style={{ left, top, zIndex: plot.x + plot.y + (slug ? 20 : 0) }}
                onClick={() => slug ? onMoveStart(slug) : choosePlot(plot)}
                disabled={busy || (!slug && !canPlace)}
                aria-label={slug ? `${definition?.name ?? slug}, plot ${plot.x + 1} ${plot.y + 1}. Select to move` : canPlace ? `Empty plot ${plot.x + 1} ${plot.y + 1}` : `Empty plot ${plot.x + 1} ${plot.y + 1}`}
              >
                <span className="city-plot__ground" />
                {decorativeTree && <span className="city-plot__tree" aria-hidden="true">🌲</span>}
                {slug && (
                  <span className="city-building">
                    <span className="city-building__shadow" />
                    <span className="city-building__body"><span>{buildingIcon(definition)}</span></span>
                    <span className="city-building__label">{definition?.name ?? slug}</span>
                    <span className="city-building__move"><Move size={10} /></span>
                  </span>
                )}
                {canPlace && <span className="city-plot__plus">+</span>}
              </button>
            );
          })}
          <div className="city-game__road" aria-hidden="true"><span>••••••••••••••</span></div>
        </div>
      </div>

      <footer className="city-game__legend">
        <span><Hand size={13} /> Tap a building to move</span>
        <span><Trees size={13} /> Focus grows population</span>
        <span><Building2 size={13} /> {Object.keys(owned).length} properties</span>
        {selected && <span className="city-game__selected"><Check size={13} /> {selected.name} selected</span>}
      </footer>
    </section>
  );
}
