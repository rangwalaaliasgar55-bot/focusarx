"use client";
import { useEffect } from "react";

/** No-op on web — Capacitor native bridges only run in iOS/Android shells. */
export function CapacitorNativeBridge() {
  useEffect(() => {}, []);
  return null;
}
