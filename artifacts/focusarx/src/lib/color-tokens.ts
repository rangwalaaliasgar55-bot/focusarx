/** Resolve a CSS color token for APIs (Three.js/canvas) that cannot consume `var(...)`. */
export function resolveColorToken(token: `--${string}`): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

/** Apply alpha to an already-resolved color without duplicating palette RGB values. */
export function colorWithAlpha(color: string, alpha: number): string {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];

  if (hex) {
    const expanded = hex.length === 3 ? [...hex].map((character) => character + character).join("") : hex;
    const red = Number.parseInt(expanded.slice(0, 2), 16);
    const green = Number.parseInt(expanded.slice(2, 4), 16);
    const blue = Number.parseInt(expanded.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
  }

  // Modern canvas implementations accept color-mix; this also covers future
  // token formats such as oklch without baking another palette into JavaScript.
  return `color-mix(in srgb, ${color} ${safeAlpha * 100}%, transparent)`;
}

/** Resolve a token and apply alpha for one-off canvas/API calls. */
export function resolveColorWithAlpha(token: `--${string}`, alpha: number): string {
  return colorWithAlpha(resolveColorToken(token), alpha);
}
