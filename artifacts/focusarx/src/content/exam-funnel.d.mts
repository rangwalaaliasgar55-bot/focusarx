// Type declarations for ./exam-funnel.mjs.

export interface FunnelAngle {
  angle: string;
  minutes: number;
}

export const FUNNEL_ANGLES: Record<string, FunnelAngle>;
export function getFunnelAngle(slug: string): FunnelAngle | null;
