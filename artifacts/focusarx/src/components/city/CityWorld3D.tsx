import { Suspense, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "three";

type Cell = { kind: "road" | "zone" | "building"; zone?: string; building?: string; level?: number; condition?: number; incident?: string };

const MODEL_PATHS: Record<string, string> = {
  house: "/city-assets/residential/house.fbx", apartments: "/city-assets/residential/apartments.fbx",
  shop: "/city-assets/commercial/shop.fbx", office: "/city-assets/commercial/office.fbx",
  factory: "/city-assets/industrial/factory.fbx", warehouse: "/city-assets/industrial/warehouse.fbx",
  powerPlant: "/city-assets/special/power-plant.fbx", waterTower: "/city-assets/special/water-tower.fbx",
  fireStation: "/city-assets/special/fire-station.fbx", hospital: "/city-assets/special/hospital.fbx", police: "/city-assets/special/police.fbx",
  road: "/city-assets/roads/straight.fbx",
};

function Model({ id, position, damaged }: { id: string; position: [number, number, number]; damaged?: boolean }) {
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
  return <primitive object={model} position={position} scale={.48} />;
}

function World({ cells, width, height, active, onPlot }: { cells: Record<string, Cell>; width: number; height: number; active: boolean; onPlot: (x: number, y: number) => void }) {
  const zoneColors: Record<string, string> = { residential: "#4ade80", commercial: "#22d3ee", industrial: "#fbbf24" };
  return (
    <group position={[-(width - 1) / 2, 0, -(height - 1) / 2]}>
      {Array.from({ length: width * height }, (_, index) => {
        const x = index % width, y = Math.floor(index / width), cell = cells[`${x}:${y}`];
        const color = cell?.kind === "road" ? "#475569" : cell?.kind === "zone" ? zoneColors[cell.zone ?? ""] ?? "#86efac" : (x + y) % 2 ? "#68b96b" : "#73c878";
        return (
          <group key={`${x}:${y}`} position={[x, 0, y]}>
            <mesh receiveShadow position={[0, -.06, 0]} onClick={(event) => { event.stopPropagation(); if (active) onPlot(x, y); }}>
              <boxGeometry args={[.96, .1, .96]} />
              <meshStandardMaterial color={color} roughness={.95} emissive={active ? color : "#000000"} emissiveIntensity={active ? .08 : 0} />
            </mesh>
            {cell?.kind === "zone" && <mesh position={[0, .012, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.68, .68]} /><meshBasicMaterial color={color} transparent opacity={.45} wireframe /></mesh>}
            {cell?.kind === "road" && <Suspense fallback={null}><Model id="road" position={[0, 0, 0]} /></Suspense>}
            {cell?.kind === "building" && cell.building && <Suspense fallback={<mesh position={[0,.35,0]}><boxGeometry args={[.5,.7,.5]} /><meshStandardMaterial color="#8b5cf6" /></mesh>}><Model id={cell.building} position={[0, 0, 0]} damaged={(cell.condition ?? 100) < 100} /></Suspense>}
            {cell?.incident && <pointLight position={[0, 1.2, 0]} color="#ef4444" intensity={2.5} distance={2} />}
          </group>
        );
      })}
    </group>
  );
}

export function CityWorld3D({ cells, width, height, active, onPlot }: { cells: Record<string, Cell>; width: number; height: number; active: boolean; onPlot: (x: number, y: number) => void }) {
  return (
    <div className="h-[520px] overflow-hidden rounded-3xl border border-[var(--forge-border)] bg-gradient-to-b from-sky-300 to-sky-100" aria-label="3D city view">
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
