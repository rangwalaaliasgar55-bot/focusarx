import { cn } from "@/lib/utils";
import { Link } from "wouter";
import type { ReactNode } from "react";

/**
 * FocusArx brand system.
 *
 * Mark: a liquid-glass squircle ("iris tile") in the brand iris gradient
 * (violet → azure) holding a calm focus reticle — a precise ring with a
 * luminous center point. The tile is rendered by the `.brand-mark` CSS
 * surface (gradient + specular highlights); the reticle glyph below is drawn
 * in `currentColor` so it inherits the surface's white or ink.
 *
 * Geometry lives in public/brand/focusarx-glyph.svg (24-unit grid) and the
 * full-bleed tile in public/brand/focusarx-mark.svg (1024). Keep the three in
 * sync — ring r .308 / stroke .096 of the viewBox, dot r .071.
 */

export function BrandGlyph({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="7.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    </svg>
  );
}

/** The iris tile itself (gradient squircle + reticle), sized by className. */
export function BrandMark({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("brand-mark", className)}
      style={size ? { width: size, height: size } : undefined}
    >
      <BrandGlyph className="h-full w-full" />
    </span>
  );
}

/**
 * Standard horizontal lockup: mark + wordmark (optionally a tagline), meant to
 * be used inside a link or a plain div — pass `as` semantics through `href`
 * (renders a wouter Link) or omit it for a plain inline element.
 */
export function BrandLockup({
  href,
  tagline,
  markClassName,
  className,
  compact = false,
  titleClassName,
  ariaLabel,
}: {
  href?: string;
  tagline?: string;
  markClassName?: string;
  className?: string;
  compact?: boolean;
  titleClassName?: string;
  ariaLabel?: string;
}) {
  const content = (
    <>
      <BrandMark className={markClassName} />
      <span className="min-w-0 text-left">
        <span
          className={cn(
            "block truncate font-semibold tracking-tight text-[var(--foreground)]",
            compact ? "text-[0.8125rem] leading-5" : "text-sm leading-5",
            titleClassName,
          )}
        >
          FocusArx
        </span>
        {tagline && (
          <span className="block truncate text-[0.6875rem] font-medium leading-4 text-[var(--foreground-subtle)]">
            {tagline}
          </span>
        )}
      </span>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? "FocusArx home"}
        className={cn("flex min-w-0 items-center gap-2.5", className)}
      >
        {content}
      </Link>
    );
  }
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {content}
    </div>
  );
}

/** Wordmark with no mark — for tight footers and dense table headers. */
export function BrandWordmark({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "font-semibold tracking-tight text-[var(--foreground)]",
        className,
      )}
    >
      {children ?? "FocusArx"}
    </span>
  );
}
