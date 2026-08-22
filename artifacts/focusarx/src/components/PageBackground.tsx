import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type Variant = "focus" | "dashboard" | "forge" | "flashcards" | "goals" | "coach" | "analytics" | "achievements" | "community" | "default";
const variants: Record<string, Variant> = {
  "/": "focus", "/dashboard": "dashboard", "/forge": "forge", "/forge-room": "forge",
  "/flashcards": "flashcards", "/goals": "goals", "/ai-insights": "coach", "/analytics": "analytics",
  "/achievements": "achievements", "/social": "community", "/groups": "community",
};

/** Lightweight, token-driven feature scenes; animation is disabled in hidden tabs. */
export default function PageBackground({ isFocusing = false }: { isFocusing?: boolean }) {
  const [location] = useLocation();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update(); document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const variant = variants[location] ?? "default";
  return <div aria-hidden className={`page-background page-background--${variant} ${hidden ? "page-background--paused" : ""} ${isFocusing ? "page-background--active" : ""}`} />;
}
