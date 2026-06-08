import { useState, useEffect } from "react";

const LS_KEY = "focusarx-theme";

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(LS_KEY) as Theme | null;
    if (stored === "dark" || stored === "light") return stored;
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  } catch {}
  return "dark";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
  }
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem(LS_KEY, theme); } catch {}
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent("focusarx:theme", { detail: theme }));
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  useEffect(() => {
    const handler = (e: Event) => {
      setThemeState((e as CustomEvent<Theme>).detail);
    };
    window.addEventListener("focusarx:theme", handler);
    return () => window.removeEventListener("focusarx:theme", handler);
  }, []);

  const update = (t: Theme) => {
    setTheme(t);
    setThemeState(t);
  };

  return [theme, update];
}
