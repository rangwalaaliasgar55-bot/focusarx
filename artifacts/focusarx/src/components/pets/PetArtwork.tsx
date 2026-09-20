import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A small, dependency-free Bulbasaur illustration used whenever the catalog
 * does not provide a network sprite.  Keeping the artwork in the app means a
 * Bulbasaur can never degrade to the old plant emoji or to another species
 * when an image host is unavailable.
 */
export function BulbasaurArtwork({ size = 120, className }: { size?: number; className?: string }) {
  // SVG paint-server IDs are document-scoped. Multiple Bulbasaurs (for
  // example, the active pet plus inventory cards) must not all reference the
  // first instance's gradient.
  const instanceId = useId().replace(/:/g, "");
  const bodyGradientId = `bulba-body-${instanceId}`;
  const bulbGradientId = `bulba-bulb-${instanceId}`;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 160"
      width={size}
      height={size}
      role="presentation"
      className={cn("inline-block", className)}
      style={{ width: size, height: size }}
    >
      <defs>
        <linearGradient id={bodyGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8bd36b" />
          <stop offset="1" stopColor="#3f9f5b" />
        </linearGradient>
        <linearGradient id={bulbGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9e57a" />
          <stop offset="1" stopColor="#4b9f54" />
        </linearGradient>
      </defs>

      {/* Grounding shadow */}
      <ellipse cx="80" cy="145" rx="45" ry="8" fill="#0f172a" opacity="0.18" />

      {/* The seed bulb and leaves sit behind the body. */}
      <path d="M55 64C45 48 48 29 66 17c-1 14 6 24 16 31C83 29 96 16 114 13c-5 17-1 31-12 44-12 14-32 18-47 7Z" fill={`url(#${bulbGradientId})`} stroke="#32734a" strokeWidth="3" strokeLinejoin="round" />
      <path d="M80 51c-5-12-5-23-1-34M86 51c9-14 16-23 25-30" fill="none" stroke="#3f824c" strokeWidth="3" strokeLinecap="round" opacity="0.75" />

      {/* Ears */}
      <path d="M45 70 30 51c-4-5 2-11 8-8l22 13Z" fill="#4a9f5c" stroke="#286341" strokeWidth="3" strokeLinejoin="round" />
      <path d="m115 70 15-19c4-5-2-11-8-8l-22 13Z" fill="#4a9f5c" stroke="#286341" strokeWidth="3" strokeLinejoin="round" />
      <path d="m38 52 15 8M122 52l-15 8" stroke="#a9dc79" strokeWidth="3" strokeLinecap="round" opacity="0.8" />

      {/* Squat body */}
      <ellipse cx="80" cy="99" rx="52" ry="42" fill={`url(#${bodyGradientId})`} stroke="#286341" strokeWidth="3" />
      <ellipse cx="80" cy="111" rx="31" ry="24" fill="#a4d878" opacity="0.76" />

      {/* Characteristic darker body spots */}
      <ellipse cx="48" cy="92" rx="8" ry="13" fill="#347b50" transform="rotate(28 48 92)" />
      <ellipse cx="116" cy="91" rx="8" ry="13" fill="#347b50" transform="rotate(-28 116 91)" />
      <ellipse cx="64" cy="128" rx="6" ry="4" fill="#347b50" />
      <ellipse cx="98" cy="128" rx="6" ry="4" fill="#347b50" />

      {/* Feet */}
      <ellipse cx="51" cy="132" rx="17" ry="9" fill="#4a9f5c" stroke="#286341" strokeWidth="3" />
      <ellipse cx="109" cy="132" rx="17" ry="9" fill="#4a9f5c" stroke="#286341" strokeWidth="3" />
      <path d="M45 132h4m7 0h4m43 0h4m7 0h4" stroke="#b9e57a" strokeWidth="2.5" strokeLinecap="round" />

      {/* Face */}
      <ellipse cx="80" cy="91" rx="38" ry="31" fill="#79c968" />
      <ellipse cx="64" cy="89" rx="8" ry="11" fill="#ef5b65" stroke="#286341" strokeWidth="2.5" />
      <ellipse cx="96" cy="89" rx="8" ry="11" fill="#ef5b65" stroke="#286341" strokeWidth="2.5" />
      <ellipse cx="64" cy="91" rx="3.2" ry="6" fill="#111827" />
      <ellipse cx="96" cy="91" rx="3.2" ry="6" fill="#111827" />
      <circle cx="65" cy="87" r="2.5" fill="#fff" />
      <circle cx="97" cy="87" r="2.5" fill="#fff" />
      <path d="M76 101q4 4 8 0" fill="none" stroke="#286341" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M71 106q9 8 18 0" fill="none" stroke="#286341" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="51" cy="105" r="4" fill="#f58b82" opacity="0.8" />
      <circle cx="109" cy="105" r="4" fill="#f58b82" opacity="0.8" />
    </svg>
  );
}

export function isBulbasaurSpecies(slug?: string | null): boolean {
  return (slug ?? "").trim().toLowerCase().replace(/-(?:2d|3d)$/, "") === "bulbasaur";
}
