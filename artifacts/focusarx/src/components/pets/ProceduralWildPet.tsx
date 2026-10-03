import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PetBodyParams } from "@/lib/petBodyParams";

/**
 * The procedural animal body — one rig, every species.
 *
 * Adapted from the PR #99 design uploads (`pet3d/bodies.tsx`), where a single
 * parameterised body had to cover a whole catalog instead of six hand-built
 * models. That is the property this keeps: `PetBodyParams` decides the animal
 * (ears, snout or beak, tail, wings, horns, proportions), and the animation
 * layer decides what it is doing. Nothing here is species-specific by name, so
 * adding a catalog row adds an animal rather than a fallback.
 *
 * Differences from the source, all deliberate:
 *
 *   • **Materials are `meshStandardMaterial`**, matching the rest of this app's
 *     3D (the source used sheen materials). Sheen is a per-fragment cost on
 *     every mesh, and at 160–240px on a phone the difference is invisible while
 *     the frame budget is not.
 *   • **The animation state vocabulary matches this app's moods** plus the
 *     battle states the arena needs (`attack`, `hurt`, `faint`), so one body
 *     serves the focus tab, the pets page and the arena.
 *   • **Pointer tracking is opt-in** (`look`), because the arena stages two of
 *     these and both tracking the cursor looks broken.
 */

export type WildAnim = "idle" | "focus" | "break" | "celebrate" | "sleep" | "attack" | "hurt" | "faint" | "happy";

/** The app's mood vocabulary (server-derived) → this rig's animation state. */
export function mapMoodToAnim(mood?: string | null): WildAnim {
  switch (mood) {
    case "excited":
      return "celebrate";
    case "sleepy":
      return "sleep";
    case "focused":
      return "focus";
    case "happy":
      return "happy";
    default:
      return "idle";
  }
}

interface WildPetProps {
  params: PetBodyParams;
  /** What the animal is doing. Battle states win over mood states. */
  anim?: WildAnim;
  /** Follow the pointer with the head (stage only, never in the arena). */
  look?: boolean;
}

type V3 = [number, number, number];

function Ball({ p = [0, 0, 0], r, s = [1, 1, 1], color, rot = [0, 0, 0], roughness = 0.75 }: { p?: V3; r: number; s?: V3; color: string; rot?: V3; roughness?: number }) {
  return (
    <mesh position={p} scale={s} rotation={rot}>
      <sphereGeometry args={[r, 28, 20]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

function darken(color: string, amount: number): string {
  return `#${new THREE.Color(color).lerp(new THREE.Color("#000000"), amount).getHexString()}`;
}

export function ProceduralWildPet({ params, anim = "idle", look = false }: WildPetProps) {
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const earL = useRef<THREE.Group>(null);
  const earR = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  // Blink phase from the animal's own colours rather than `Math.random()`: the
  // render has to be pure (the house lint forbids impure calls during render),
  // and a phase derived from the body keeps two pets on screen out of step.
  const blinkOffset = useMemo(() => {
    let h = 0x811c9dc5;
    for (const ch of `${params.body}|${params.belly}`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193);
    }
    return ((h >>> 0) % 400) / 100;
  }, [params.body, params.belly]);

  const { body, belly, patch, ears, tail: tailKind, beak, wings, snout, horns, squish = 1, plan } = params;
  const sleeping = anim === "sleep" || anim === "faint";
  // Computed once, outside the narrowing below: TypeScript learns from
  // `sleeping`'s definition that `anim` is not "faint" on the else branch, so
  // comparing against it there is flagged as impossible even though the value
  // is exactly what the eye-blinking rule needs to look for.
  const hurtLike = anim === "hurt" || anim === "faint";
  const limbColor = patch ?? body;
  const wingColor = darken(body, 0.16);
  // Aquatic and serpentine bodies read better flatter and longer; the plan is
  // the one part of the description that changes the *silhouette*, so it is
  // applied to the whole rig rather than to a part.
  const bodyScale: V3 = plan === "serpent" ? [0.9, 0.82, 1.25] : plan === "aquatic" ? [1.05, 0.85, 1.2] : plan === "bird" ? [0.95, 1.05, 1] : [1, 1, 1];

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (root.current) {
      // Breathing and (for the celebrate state) a hop. Every animated property
      // is transform-only, so the GPU never lays out.
      const hop = anim === "celebrate" ? Math.abs(Math.sin(t * 4)) * 0.12 : 0;
      root.current.position.y = Math.sin(t * 1.6) * (sleeping ? 0.015 : 0.03) + hop;
      root.current.rotation.y = THREE.MathUtils.damp(
        root.current.rotation.y,
        anim === "attack" ? -0.35 : anim === "hurt" ? 0.28 : 0,
        8,
        dt,
      );
    }
    const h = head.current;
    if (h) {
      const pointerX = look && !sleeping ? state.pointer.x * 0.6 : 0;
      const pointerY = look && !sleeping ? -state.pointer.y * 0.28 : 0;
      const tilt = sleeping ? 0.42 : anim === "focus" ? 0.16 : anim === "attack" ? -0.2 : pointerY;
      h.rotation.y = THREE.MathUtils.damp(h.rotation.y, pointerX, 6, dt);
      h.rotation.x = THREE.MathUtils.damp(h.rotation.x, tilt, 6, dt);
      h.rotation.z = THREE.MathUtils.damp(
        h.rotation.z,
        sleeping ? 0.14 : anim === "break" ? Math.sin(t * 3) * 0.1 : anim === "hurt" ? -0.12 : 0,
        6,
        dt,
      );
    }
    const e = eyes.current;
    if (e) {
      const cycle = (t * 0.9 + blinkOffset) % 4;
      const blink = cycle < 0.13 ? 0.08 : 1;
      const target = sleeping ? 0.07 : hurtLike ? 0.3 : blink;
      e.scale.y = THREE.MathUtils.damp(e.scale.y, target, 30, dt);
    }
    const tl = tail.current;
    if (tl) {
      const speed = anim === "celebrate" || anim === "happy" ? 9 : anim === "focus" ? 4 : 2.4;
      tl.rotation.y = Math.sin(t * speed) * (sleeping ? 0.05 : 0.45);
    }
    const flap = anim === "celebrate" ? 0.55 : anim === "focus" ? 0.12 : anim === "break" ? 0.3 : 0.05;
    const f = Math.sin(t * (anim === "celebrate" ? 16 : 5)) * flap;
    if (wingL.current) wingL.current.rotation.z = -0.25 - f;
    if (wingR.current) wingR.current.rotation.z = 0.25 + f;
    const twitch = Math.sin(t * 7) > 0.97 ? 0.3 : 0;
    if (earL.current) earL.current.rotation.z = THREE.MathUtils.damp(earL.current.rotation.z, 0.12 + twitch, 14, dt);
    if (earR.current) earR.current.rotation.z = THREE.MathUtils.damp(earR.current.rotation.z, -0.12, 14, dt);
  });

  const eyeSize = plan === "bird" ? 0.12 : 0.1;
  const eyeX = plan === "bird" ? 0.24 : 0.23;

  return (
    <group ref={root} scale={[bodyScale[0], bodyScale[1] * squish, bodyScale[2]]}>
      {/* body */}
      <Ball p={[0, 0.6, 0]} r={0.6} s={[1, 0.95, 0.96]} color={body} />
      <Ball p={[0, 0.54, 0.3]} r={0.46} s={[0.9, 0.98, 0.55]} color={belly} />

      {/* feet */}
      {[-1, 1].map((sx) => (
        <Ball key={`f${sx}`} p={[sx * 0.28, 0.1, 0.34]} r={0.19} s={[1, 0.6, 1.35]} color={limbColor} />
      ))}
      {/* arms — a wing species uses the wing groups instead */}
      {!wings &&
        [-1, 1].map((sx) => (
          <Ball key={`a${sx}`} p={[sx * 0.58, 0.66, 0.22]} r={0.16} s={[0.8, 1.25, 0.85]} color={limbColor} rot={[0, 0, sx * 0.35]} />
        ))}

      {wings && (
        <>
          <group ref={wingL} position={[-0.6, 0.78, -0.05]}>
            <Ball p={[-0.04, -0.18, 0]} r={0.34} s={[0.28, 1, 0.7]} color={wingColor} />
          </group>
          <group ref={wingR} position={[0.6, 0.78, -0.05]}>
            <Ball p={[0.04, -0.18, 0]} r={0.34} s={[0.28, 1, 0.7]} color={wingColor} />
          </group>
        </>
      )}

      <group ref={tail} position={[0, 0.42, -0.5]}>
        {tailKind === "fluffy" && (
          <>
            <Ball p={[0, 0.12, -0.28]} r={0.3} s={[0.85, 0.85, 1.6]} rot={[-0.5, 0, 0]} color={body} />
            <Ball p={[0, 0.32, -0.62]} r={0.17} s={[1, 1, 1.1]} color={belly} />
          </>
        )}
        {tailKind === "long" && (
          <>
            <Ball p={[0, 0.0, -0.18]} r={0.14} color={body} />
            <Ball p={[0, 0.1, -0.38]} r={0.13} color={body} />
            <Ball p={[0, 0.26, -0.52]} r={0.12} color={body} />
            <Ball p={[0, 0.46, -0.58]} r={0.12} color={patch ?? body} />
          </>
        )}
        {tailKind === "stub" && <Ball p={[0, 0.02, -0.12]} r={0.16} color={belly} />}
      </group>

      <group ref={head} position={[0, 1.38, 0.02]}>
        <Ball r={0.62} s={[1.1, 0.95, 1]} color={body} />

        {ears !== "none" &&
          [-1, 1].map((sx) => (
            <group key={`e${sx}`} ref={sx < 0 ? earL : earR} position={[sx * 0.4, 0.5, 0]} rotation={[0, 0, -sx * 0.12]}>
              {ears === "round" && <Ball p={[sx * 0.04, 0.08, 0]} r={0.2} s={[1, 1, 0.55]} color={limbColor} />}
              {ears === "pointy" && (
                <mesh position={[sx * 0.04, 0.16, 0]} rotation={[0, 0, -sx * 0.2]}>
                  <coneGeometry args={[0.2, 0.46, 20]} />
                  <meshStandardMaterial color={body} roughness={0.8} />
                </mesh>
              )}
              {ears === "long" && <Ball p={[sx * 0.04, 0.3, 0]} r={0.15} s={[0.75, 2.3, 0.5]} color={body} rot={[0, 0, -sx * 0.18]} />}
              {ears === "tuft" && (
                <mesh position={[sx * 0.02, 0.14, 0]} rotation={[0, 0, -sx * 0.55]}>
                  <coneGeometry args={[0.15, 0.4, 14]} />
                  <meshStandardMaterial color={darken(body, 0.2)} roughness={0.8} />
                </mesh>
              )}
            </group>
          ))}

        {horns &&
          [-1, 1].map((sx) => (
            <mesh key={`h${sx}`} position={[sx * 0.28, 0.58, 0.05]} rotation={[-0.2, 0, -sx * 0.35]}>
              <coneGeometry args={[0.09, 0.4, 14]} />
              <meshStandardMaterial color="#f2e6c9" roughness={0.45} />
            </mesh>
          ))}

        {/* Facial disc for birds, patch masks otherwise. */}
        {plan === "bird" &&
          [-1, 1].map((sx) => <Ball key={`d${sx}`} p={[sx * eyeX, 0.04, 0.46]} r={0.23} s={[1, 1, 0.4]} color={belly} />)}
        {patch &&
          plan !== "bird" &&
          [-1, 1].map((sx) => <Ball key={`c${sx}`} p={[sx * 0.4, -0.17, 0.36]} r={0.2} s={[1, 0.8, 0.8]} color={patch} />)}

        <group ref={eyes} position={[0, 0.04, 0]}>
          {[-1, 1].map((sx) => (
            <group key={`ey${sx}`} position={[sx * eyeX, 0, 0.55]}>
              <mesh scale={[1, 1.15, 0.8]}>
                <sphereGeometry args={[eyeSize, 20, 14]} />
                <meshStandardMaterial color="#17171d" roughness={0.15} metalness={0.1} />
              </mesh>
              <mesh position={[0.035, 0.045, 0.07]}>
                <sphereGeometry args={[0.032, 10, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </group>

        {snout && (
          <>
            <Ball p={[0, -0.14, 0.52]} r={0.22} s={[1.15, 0.8, 0.9]} color={patch ?? belly} />
            <mesh position={[0, -0.05, 0.72]} scale={[1.2, 0.8, 0.8]}>
              <sphereGeometry args={[0.065, 14, 10]} />
              <meshStandardMaterial color="#1a1a20" roughness={0.3} />
            </mesh>
          </>
        )}
        {beak && (
          <mesh position={[0, -0.1, 0.64]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.1, 0.24, 18]} />
            <meshStandardMaterial color="#f2a33a" roughness={0.45} />
          </mesh>
        )}
        {!snout && !beak && (
          <mesh position={[0, -0.08, 0.6]} scale={[1.2, 0.8, 0.8]}>
            <sphereGeometry args={[0.048, 12, 8]} />
            <meshStandardMaterial color="#2a2028" roughness={0.3} />
          </mesh>
        )}
      </group>
    </group>
  );
}

export default ProceduralWildPet;
