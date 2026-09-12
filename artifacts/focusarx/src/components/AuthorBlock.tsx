import { Link } from "wouter";
import { resolveAuthor, type AuthorRef } from "@/content/authors.mjs";

/**
 * Byline and freshness line.
 *
 * E-E-A-T is mostly "can a reader tell who is responsible for this page, and
 * when it was last checked". Both answers used to be missing: pages were
 * published under an Organization name in the JSON-LD and nothing on the page,
 * and the only date a reader could see sat at the bottom of the sources block
 * on pages that happened to have one.
 *
 * The author comes from src/content/authors.mjs, which scripts/prerender.mjs
 * reads too, so the visible byline and the Article schema's `author` cannot
 * disagree. When a named person is added to PEOPLE there, this component shows
 * their photo and credentials instead of the team line — no page changes needed.
 */
export function AuthorBlock({
  author,
  published,
  lastReviewed,
  readMin,
  className = "",
}: {
  /** Author id from PEOPLE, an author object, or undefined for the team. */
  author?: AuthorRef;
  /** ISO date the piece was first published. */
  published?: string | null;
  /** ISO date the copy was last checked against reality. */
  lastReviewed?: string | null;
  readMin?: number | null;
  className?: string;
}) {
  const a = resolveAuthor(author);

  const meta: { text: string; iso?: string }[] = [];
  if (published) meta.push({ text: formatLongDate(published), iso: published });
  if (readMin) meta.push({ text: `${readMin} min read` });
  if (lastReviewed) {
    meta.push({ text: `Last updated ${formatLongDate(lastReviewed)}`, iso: lastReviewed });
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs text-[var(--foreground-subtle)] ${className}`}
    >
      {a.photo ? (
        <img
          src={a.photo}
          // The name is printed next to the photo, so the image is decoration
          // and screen readers should skip it (see src/images.seo.test.ts).
          alt=""
          aria-hidden="true"
          width={28}
          height={28}
          className="h-7 w-7 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[10px] font-bold text-[var(--brand-strong)]"
        >
          FA
        </span>
      )}

      <span className="font-semibold text-[var(--foreground-muted)]">{a.name}</span>
      <Dot />
      <span>{a.role}</span>

      {meta.map((item) => (
        <span key={item.text} className="flex items-center gap-x-2.5">
          <Dot />
          {item.iso ? <time dateTime={item.iso}>{item.text}</time> : item.text}
        </span>
      ))}

      <Dot />
      <Link href="/about" className="text-[var(--brand-strong)] underline-offset-4 hover:underline">
        Who writes this
      </Link>
    </div>
  );
}

function Dot() {
  return <span aria-hidden="true">·</span>;
}

/** "2026-09-05" → "5 September 2026" — the format the rest of the site uses. */
export function formatLongDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
