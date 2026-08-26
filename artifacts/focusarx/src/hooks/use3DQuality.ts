"use client";

import { useEffect, useState } from "react";

export type QualityMode = "high" | "balanced" | "battery" | "off";

const STORAGE_KEY = "focusarx-3d-quality";
const APPEARANCE_KEY = "focusarx-3d-effects"; // On / Reduced / Off from Settings

export function use3DQuality() {
  const [quality, setQuality] = useState<QualityMode>(() => {
    if (typeof window === "undefined") return "balanced";
    const stored = localStorage.getItem(STORAGE_KEY) as QualityMode | null;
    if (stored && ["high", "balanced", "battery", "off"].includes(stored)) {
      return stored;
    }
    // Mobile defaults to Balanced or Battery saver
    const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isMobile ? "battery" : "balanced";
  });

  const [appearance, setAppearance] = useState<"on" | "reduced" | "off">(() => {
    if (typeof window === "undefined") return "on";
    const stored = localStorage.getItem(APPEARANCE_KEY) as "on" | "reduced" | "off" | null;
    return stored || "on";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, quality);
  }, [quality]);

  useEffect(() => {
    localStorage.setItem(APPEARANCE_KEY, appearance);
  }, [appearance]);

  // Effective quality considers appearance setting
  const effectiveQuality: QualityMode = (() => {
    if (appearance === "off") return "off";
    if (appearance === "reduced") return quality === "high" ? "balanced" : quality;
    return quality;
  })();

  const isOff = effectiveQuality === "off";
  const isHigh = effectiveQuality === "high";
  const isBalanced = effectiveQuality === "balanced";
  const isBattery = effectiveQuality === "battery";

  return {
    quality,
    effectiveQuality,
    appearance,
    isOff,
    isHigh,
    isBalanced,
    isBattery,
    setQuality,
    setAppearance,
    // Config for 3D
    config: {
      dpr: isHigh ? ([1, 2] as [number, number]) : isBalanced ? ([1, 1.5] as [number, number]) : ([1, 1.2] as [number, number]),
      shadows: isHigh,
      antialias: isHigh,
      particleCount: isHigh ? 22 : isBalanced ? 12 : 0,
      shadowResolution: isHigh ? 1024 : isBalanced ? 512 : 0,
      lights: isHigh ? 3 : isBalanced ? 2 : 1,
      animatedObjects: isHigh ? 10 : isBalanced ? 5 : 2,
      textureSize: isHigh ? 1024 : isBalanced ? 512 : 256,
      reflections: isHigh,
      cameraMovement: isHigh || isBalanced,
      postProcessing: isHigh,
      backgroundEffects: isHigh,
      autoRotate: isHigh || isBalanced,
      environment: isHigh,
      contactShadows: isHigh || isBalanced,
    },
  };
}
