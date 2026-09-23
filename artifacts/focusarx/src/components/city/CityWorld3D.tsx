import { Suspense, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "three";

type Cell = { kind: "road" | "zone" | "building"; zone?: string; building?: string; level?: number; condition?: number; incident?: string; abandoned?: boolean };

const MODEL_PATHS: Record<string, string> = {
  house: "/city-assets/residential/house.fbx", apartments: "/city-assets/residential/apartments.fbx",
  shop: "/city-assets/commercial/shop.fbx", office: "/city-assets/commercial/office.fbx",
  factory: "/city-assets/industrial/factory.fbx", warehouse: "/city-assets/industrial/warehouse.fbx",
  powerPlant: "/city-assets/special/power-plant.fbx", waterTower: "/city-assets/special/water-tower.fbx",
  fireStation: "/city-assets/special/fire-station.fbx", hospital: "/city-assets/special/hospital.fbx", police: "/city-assets/special/police.fbx",
  road: "/city-assets/roads/straight.fbx", roadEnd: "/city-assets/roads/end.fbx", roadCurve: "/city-assets/roads/curve.fbx",
  roadIntersection: "/city-assets/roads/intersection.fbx", roadCrossroad: "/city-assets/roads/crossroad.fbx",
};

function Model({ id, position, damaged, rotation = 0, level = 1 }: { id: string; position: [number, number, number]; damaged?: boolean; rotation?: number; level?: number }) {
  const source = useLoader(FBXLoader, MODEL_PATHS[id] ?? MODEL_PATHS.house!);
  const model = useMemo(() => {
    const clone = source.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true; child.receiveShadow = true;
        if (damaged) {
          const material = Array.isArray(child.material) ? child.material[0] : child.material;
          child.material = new THREE.MeshStandardMaterial({ color: "#7f1d1d", roughness: .9, map: material?.map ?? null });
        }
      }
    });
    return clone;
  }, [damaged, source]);
  return <primitive object={model} position={position} rotation={[0, rotation, 0]} scale={[.48, .48 * (1 + (level - 1) * .18), .48]} />;
}

function CivicPrimitive({ id }: { id: "park" | "school" }) {
  if (id === "park") return <group><mesh position={[0,.22,0]} castShadow><cylinderGeometry args={[.13,.2,.45,8]} /><meshStandardMaterial color="#854d0e" /></mesh><mesh position={[0,.63,0]} castShadow><sphereGeometry args={[.38,10,8]} /><meshStandardMaterial color="#16a34a" /></mesh></group>;
  return <group><mesh position={[0,.3,0]} castShadow><boxGeometry args={[.72,.6,.62]} /><meshStandardMaterial color="#f1f5f9" /></mesh><mesh position={[0,.66,0]} rotation={[0,Math.PI/4,0]} castShadow><coneGeometry args={[.58,.28,4]} /><meshStandardMaterial color="#7c3aed" /></mesh></group>;
}

function roadVisual(cells: Record<string, Cell>, x: number, y: number) {
  const up = cells[`${x}:${y - 1}`]?.kind === "road", down = cells[`${x}:${y + 1}`]?.kind === "road";
  const left = cells[`${x - 1}:${y}`]?.kind === "road", right = cells[`${x + 1}:${y}`]?.kind === "road";
  const count = [up, down, left, right].filter(Boolean).length;
  if (count >= 4) return { id: "roadCrossroad", rotation: 0 };
  if (count === 3) return { id: "roadIntersection", rotation: !down ? 0 : !left ? Math.PI / 2 : !up ? Math.PI : -Math.PI / 2 };
  if (count === 2 && !((up && down) || (left && right))) return { id: "roadCurve", rotation: up && right ? 0 : right && down ? Math.PI / 2 : down && left ? Math.PI : -Math.PI / 2 };
  if (count <= 1) return { id: "roadEnd", rotation: up ? Math.PI : right ? -Math.PI / 2 : down ? 0 : Math.PI / 2 };
  return { id: "road", rotation: up && down ? Math.PI / 2 : 0 };
}

function World({ cells, width, height, active, onPlot }: { cells: Record<string, Cell>; width: number; height: number; active: boolean; onPlot: (x: number, y: number) => void }) {
  const zoneColors: Record<string, string> = { residential: "#4ade80", commercial: "#22d3ee", industrial: "#fbbf24" };
  return (
    <group position={[-(width - 1) / 2, 0, -(height - 1) / 2]}>
      {Array.from({ length: width * height }, (_, index) => {
        const x = index % width, y = Math.floor(index / width), cell = cells[`${x}:${y}`];
        const color = cell?.kind === "road" ? "#475569" : cell?.kind === "zone" ? zoneColors[cell.zone ?? ""] ?? "#86efac" : (x + y) % 2 ? "#68b96b" : "#73c878";
        const road = cell?.kind === "road" ? roadVisual(cells, x, y) : null;
        return (
          <group key={`${x}:${y}`} position={[x, 0, y]}>
            <mesh receiveShadow position={[0, -.06, 0]} onClick={(event) => { event.stopPropagation(); onPlot(x, y); }}>
              <boxGeometry args={[.96, .1, .96]} />
              <meshStandardMaterial color={color} roughness={.95} emissive={active ? color : "#000000"} emissiveIntensity={active ? .08 : 0} />
            </mesh>
            {cell?.kind === "zone" && <mesh position={[0, .012, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.68, .68]} /><meshBasicMaterial color={color} transparent opacity={.45} wireframe /></mesh>}
            {road && <Suspense fallback={null}><Model id={road.id} position={[0, 0, 0]} rotation={road.rotation} /></Suspense>}
            {cell?.kind === "building" && cell.building && (["park", "school"].includes(cell.building)
              ? <CivicPrimitive id={cell.building as "park" | "school"} />
              : <Suspense fallback={<mesh position={[0,.35,0]}><boxGeometry args={[.5,.7,.5]} /><meshStandardMaterial color="#8b5cf6" /></mesh>}><Model id={cell.building} position={[0, 0, 0]} damaged={(cell.condition ?? 100) < 100 || cell.abandoned} level={cell.level ?? 1} /></Suspense>)}
            {cell?.incident && <pointLight position={[0, 1.2, 0]} color="#ef4444" intensity={2.5} distance={2} />}
          </group>
        );
      })}
    </group>
  );
}

export function CityWorld3D({ cells, width, height, active, onPlot }: { cells: Record<string, Cell>; width: number; height: number; active: boolean; onPlot: (x: number, y: number) => void }) {
  return (
    <div className="h-[520px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--forge-border)] bg-gradient-to-b from-sky-300 to-sky-100" aria-label="3D city view">
      <Canvas shadows dpr={[1, 1.6]} gl={{ antialias: true }}>
        <color attach="background" args={["#b9e3ff"]} />
        <fog attach="fog" args={["#dbeafe", 12, 27]} />
        <OrthographicCamera makeDefault position={[10, 12, 12]} zoom={48} near={.1} far={100} />
        <ambientLight intensity={1.4} />
        <directionalLight castShadow position={[8, 14, 6]} intensity={2.3} shadow-mapSize={[1024, 1024]} />
        <World cells={cells} width={width} height={height} active={active} onPlot={onPlot} />
        <OrbitControls makeDefault enableDamping minZoom={28} maxZoom={90} maxPolarAngle={Math.PI / 2.15} target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}
