const KEY = "focusarx:acquisition:v1";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const KEYS = ["src", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"] as const;
export type Acquisition = Partial<Record<(typeof KEYS)[number], string>> & { capturedAt: number; landingPath: string };

export function parseAcquisition(search: string, pathname: string, now = Date.now()): Acquisition | null {
  const params = new URLSearchParams(search);
  const values: Record<string, string> = {};
  for (const key of KEYS) {
    const value = (params.get(key) ?? "").trim().slice(0, key.endsWith("clid") ? 120 : 80);
    if (value) values[key] = value;
  }
  return Object.keys(values).length ? { ...values, capturedAt: now, landingPath: pathname.slice(0, 200) } as Acquisition : null;
}

export function captureAcquisition(search = window.location.search, pathname = window.location.pathname): Acquisition | null {
  try {
    const next = parseAcquisition(search, pathname);
    if (next) { localStorage.setItem(KEY, JSON.stringify(next)); return next; }
    return getAcquisition();
  } catch { return null; }
}

export function getAcquisition(now = Date.now()): Acquisition | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Acquisition | null;
    if (!parsed || !Number.isFinite(parsed.capturedAt) || now - parsed.capturedAt > TTL_MS) { localStorage.removeItem(KEY); return null; }
    return parsed;
  } catch { return null; }
}

export function acquisitionEventData(): Record<string, unknown> {
  const acquisition = getAcquisition();
  if (!acquisition) return {};
  return { acquisition: { ...acquisition } };
}
