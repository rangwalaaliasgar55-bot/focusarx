/**
 * User-local calendar days (Phase 5.3 STREAK fix).
 *
 * Streaks, productivity logs and weekly resets were keyed to IST (UTC+5:30)
 * for every user on Earth (`istDate.ts`). Anyone outside India gained or
 * lost days — the #2 retention killer in this category.
 *
 * Rules implemented here:
 * 1. The day key is computed in the user's own IANA zone
 *    (`users.timezone`, adopted from the device on session write).
 * 2. Missing/invalid zones (including the untouched `"UTC"` schema default)
 *    fall back to the legacy IST calendar, so existing users keep exactly
 *    the behaviour they have today until a real zone is known.
 * 3. Zone switches never silently reset a streak: when the stored
 *    `lastStudyDate` matches *either* the new zone's yesterday *or* the
 *    legacy IST yesterday, the streak continues.
 * 4. All calendar math is DST-safe: day keys are derived with `Intl` in the
 *    target zone, and "yesterday" is computed by shifting the YYYY-MM-DD
 *    string, never by subtracting 86_400_000 ms across a DST transition.
 */

export const LEGACY_FALLBACK_ZONE = "Asia/Kolkata";
const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for real IANA zones Node/browsers can format in. */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 60) return false;
  try {
    Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the zone used for day keys. The `"UTC"` schema default means
 * "never set" (it predates zone-aware streaks), so it maps to the legacy
 * IST calendar to preserve current behaviour.
 */
export function resolveUserZone(stored: unknown): string {
  if (typeof stored === "string" && stored !== "UTC" && isValidTimeZone(stored)) {
    return stored;
  }
  return LEGACY_FALLBACK_ZONE;
}

/** Calendar day key (YYYY-MM-DD) of `now` in `timeZone`. */
export function dayKeyInZone(now: Date | number = new Date(), timeZone: string): string {
  const d = typeof now === "number" ? new Date(now) : now;
  try {
    // en-CA yields ISO-like YYYY-MM-DD ordering.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: LEGACY_FALLBACK_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }
}

/** Shift a YYYY-MM-DD key by whole calendar days (DST-proof). */
export function shiftDayKey(key: string, deltaDays: number): string {
  const m = DAY_KEY_RE.exec(key);
  if (!m) throw new Error(`shiftDayKey: invalid day key ${JSON.stringify(key)}`);
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + deltaDays * 86_400_000;
  return new Date(utc).toISOString().slice(0, 10);
}

/** Monday 00:00 of the week containing `now`, in `timeZone`, as a UTC instant. */
export function weekStartInZone(now: Date | number = new Date(), timeZone: string): Date {
  const today = dayKeyInZone(now, timeZone);
  // Weekday in the target zone (1=Mon..7=Sun), DST-safe via string math below.
  let weekday: number;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
    const day = fmt.format(typeof now === "number" ? new Date(now) : now);
    weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[day] ?? 1;
  } catch {
    weekday = 1;
  }
  const mondayKey = shiftDayKey(today, -(weekday - 1));
  return dayStartInZone(mondayKey, timeZone);
}

/**
 * UTC instant of 00:00 on a YYYY-MM-DD calendar day in `timeZone`.
 * Implemented by probing: noon UTC on that date is always the same civil
 * day in every zone within ±12 h, then walk back using the zone offset.
 */
export function dayStartInZone(dayKey: string, timeZone: string): Date {
  const m = DAY_KEY_RE.exec(dayKey);
  if (!m) throw new Error(`dayStartInZone: invalid day key ${JSON.stringify(dayKey)}`);
  const noonUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  const offsetMs = zoneOffsetAt(noonUtc, timeZone);
  return new Date(noonUtc - offsetMs - 12 * 3_600_000);
}

/** Offset of `timeZone` ahead of UTC at `utcMs` (positive east of Greenwich). */
function zoneOffsetAt(utcMs: number, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = Object.fromEntries(
      dtf.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second),
    );
    return asUtc - utcMs;
  } catch {
    return 5.5 * 3_600_000; // legacy IST fallback
  }
}

/** Hour of day (0–23) and weekday (0=Sun..6=Sat) of an instant in `timeZone`. */
export function clockInZone(at: Date | number, timeZone: string): { hour: number; weekday: number } {
  const d = typeof at === "number" ? new Date(at) : at;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(d);
    const hour = Number(parts.find(p => p.type === "hour")?.value ?? 0) % 24;
    const wd = parts.find(p => p.type === "weekday")?.value ?? "Sun";
    const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] ?? 0;
    return { hour, weekday };
  } catch {
    return { hour: d.getUTCHours(), weekday: d.getUTCDay() };
  }
}

/** Weekday (0=Sun..6=Sat) of a YYYY-MM-DD calendar key. */
export function weekdayOfDayKey(key: string): number {
  const m = DAY_KEY_RE.exec(key);
  if (!m) return 0;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}
