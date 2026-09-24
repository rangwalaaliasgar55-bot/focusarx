/**
 * Lightweight scroll presentation primitives for public marketing pages.
 *
 * These used to import the full Framer Motion runtime. Public routes only need
 * a subtle, progressively-enhanced entrance, so CSS animation is preferable:
 * no animation vendor chunk needs to download before the hero becomes useful.
 * The wrappers retain the old component API so product pages can opt into more
 * sophisticated motion later without changing their markup.
 */
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export const EASE_APPLE = [0.16, 1, 0.3, 1] as const;

type ElementName = "div" | "section" | "article" | "header" | "li" | "span";
type RevealProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
  delay?: number;
  distance?: number;
  as?: ElementName;
};

function entranceStyle(style: CSSProperties | undefined, delay: number): CSSProperties {
  return {
    ...style,
    animationDelay: delay ? `${delay}s` : undefined,
  };
}

/** A compositor-only entrance; reduced-motion users receive static content. */
export function Reveal({ delay = 0, distance: _distance = 24, as = "div", children, className, style, ...rest }: RevealProps) {
  const Tag = as;
  return (
    <Tag
      {...rest}
      className={["motion-safe:animate-rise-in", className].filter(Boolean).join(" ")}
      style={entranceStyle(style, delay)}
    >
      {children}
    </Tag>
  );
}

type StaggerProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

export function RevealStagger({ children, className, ...rest }: StaggerProps) {
  return <div {...rest} className={["motion-safe:animate-rise-in", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function RevealItem({ children, className, ...rest }: StaggerProps) {
  return <div {...rest} className={["motion-safe:animate-rise-in", className].filter(Boolean).join(" ")}>{children}</div>;
}

/** Keep visual hierarchy without a JS scroll observer or spring runtime. */
export function ScrollScale({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["motion-safe:animate-rise-in", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function HeroScrub({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function Parallax({ children, className }: { children: ReactNode; className?: string; amount?: number }) {
  return <div className={className}>{children}</div>;
}
