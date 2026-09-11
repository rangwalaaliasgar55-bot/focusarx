import { Link } from "wouter";
import { ArrowRight, Layers } from "lucide-react";
import { pillarCluster, pillarLinksFor, siblingSpokes } from "@/content/clusters.mjs";

/**
 * Pillar–cluster navigation.
 *
 * One component, two jobs, decided by what `path` is:
 *
 *  - On a **pillar** (/pomodoro-guide, /deep-work-guide, /exam) it renders the
 *    whole cluster — every guide, tool and timer that belongs to it. A pillar
 *    that does not link out to its own cluster cannot pass authority to it.
 *  - On a **spoke** it renders the way back: the pillar it belongs to, plus a
 *    few siblings. Spokes that only ever link "up" to the homepage are how a
 *    cluster turns into 100 documents with nothing holding them together.
 *
 * Both directions come from src/content/clusters.mjs, which scripts/prerender.mjs
 * also renders from — so the static document a crawler reads and the page a
 * visitor clicks carry the same wiring, and scripts/seo-validate.mjs fails the
 * build if a spoke's document forgets its pillar.
 *
 * `exclude` takes the hrefs the page already links to (its "Keep reading" list),
 * so a page never shows the same destination twice.
 */
export function ClusterLinks({
  path,
  exclude = [],
  limit = 6,
  className = "",
}: {
  /** This page's route path, e.g. "/exam/gre". */
  path: string;
  /** Hrefs already linked from the page. */
  exclude?: Iterable<string>;
  /** How many sibling spokes to offer alongside the pillar link. */
  limit?: number;
  className?: string;
}) {
  const skip = new Set(exclude);
  const shell = `rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 sm:p-6`;
  const eyebrow =
    "flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]";
  const linkClass =
    "inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] text-sm font-medium text-[var(--brand-strong)] transition-colors duration-[var(--duration-fast)] hover:underline hover:underline-offset-4";

  // ── Pillar: the whole cluster ──────────────────────────────────────────
  const pillar = pillarCluster(path);
  if (pillar) {
    const spokes = pillar.spokes.filter((spoke) => !skip.has(spoke.path));
    if (spokes.length === 0) return null;
    return (
      <nav aria-label={`All ${pillar.label} pages`} className={`${shell} ${className}`}>
        <p className={eyebrow}>
          <Layers size={13} aria-hidden="true" />
          The {pillar.label.toLowerCase()} cluster
        </p>
        <p className="text-body mt-3 max-w-2xl text-[var(--foreground-muted)]">{pillar.blurb}</p>
        <ul className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {spokes.map((spoke) => (
            <li key={spoke.path}>
              <Link href={spoke.path} className={linkClass}>
                {spoke.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  // ── Spoke: the way back, plus a few neighbours ─────────────────────────
  const all = pillarLinksFor(path);
  // A page that already links its pillar in "Keep reading" does not need the
  // link twice — but it should still say which cluster these neighbours are in.
  const pillars = all.filter((p) => !skip.has(p.href));
  const siblings = siblingSpokes(path, limit, [...skip, ...all.map((p) => p.href)]);
  if (pillars.length === 0 && siblings.length === 0) return null;
  const clusterNames = all.map((p) => p.cluster).join(" and ");

  return (
    <nav aria-label="Topic clusters" className={`${shell} ${className}`}>
      <p className={eyebrow}>
        <Layers size={13} aria-hidden="true" />
        {clusterNames} cluster
      </p>
      {pillars.length > 0 && (
        <ul className="mt-3 grid gap-1">
          {pillars.map((p) => (
            <li key={p.href}>
              <Link href={p.href} className={linkClass}>
                {p.label}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {siblings.length > 0 && (
        <ul className="mt-3 grid gap-x-6 gap-y-1 border-t border-[var(--border-subtle)] pt-3 sm:grid-cols-2">
          {siblings.map((sibling) => (
            <li key={sibling.path}>
              <Link
                href={sibling.path}
                className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] text-sm text-[var(--foreground-muted)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--brand-strong)] hover:underline hover:underline-offset-4"
              >
                {sibling.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
