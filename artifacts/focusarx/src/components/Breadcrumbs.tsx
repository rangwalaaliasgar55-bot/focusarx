import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { breadcrumbTrail } from "@/lib/breadcrumbs.mjs";

/**
 * Visible breadcrumb trail for nested pages.
 *
 * The BreadcrumbList JSON-LD has been in the head for a while (prerender +
 * PageSEO), but nothing on the page showed the trail — structured data that
 * describes navigation a reader cannot see is worth much less, and Google
 * compares the two. Labels come from the same `breadcrumbTrail()` the schemas
 * use, so the visible trail and the structured data cannot disagree.
 *
 * The last crumb is the current page and is not a link. An intermediate crumb
 * is only a link when that hub route actually exists (`LINKABLE_SEGMENTS`) —
 * otherwise it renders as plain text, because a breadcrumb trail full of 404s
 * is worse than none.
 */
export function Breadcrumbs({
  path,
  title,
  className = "",
}: {
  /** Route path, e.g. "/exam/gre". */
  path: string;
  /** Page title — used for the last crumb, brand suffix stripped. */
  title?: string;
  className?: string;
}) {
  const trail = breadcrumbTrail(path, { title });

  // The homepage has nothing above it: a one-item trail is noise.
  if (trail.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[var(--foreground-subtle)]">
        {trail.map((crumb, i) => {
          const isLast = i === trail.length - 1;
          const linkable = crumb.linkable !== false && !isLast;
          return (
            <li key={crumb.path} className="flex items-center gap-x-1.5">
              {i > 0 && <ChevronRight size={12} aria-hidden="true" className="shrink-0 opacity-50" />}
              {!linkable ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "font-medium text-[var(--foreground-muted)]" : undefined}
                >
                  {crumb.name}
                </span>
              ) : (
                <Link
                  href={crumb.path}
                  className="inline-flex min-h-[24px] items-center rounded transition-colors hover:text-[var(--brand-strong)] hover:underline hover:underline-offset-4"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
