import { Link } from "wouter";
import { PageSEO } from "@/components/PageSEO";
import { BLOG_POSTS } from "@/content/blog.mjs";
import { fmtDate } from "@/lib/locale";

/** Public blog index (Phase 4.1). One idea per screen: three essays, no noise. */
export default function BlogPage() {
  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-16 sm:px-6">
      <PageSEO
        title="Blog | Focus, Deep Work and Study Science | FocusArx"
        description="Short essays on focus, deep work and study science: why 25 minutes works, attention residue, and body doubling."
      />
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
        FocusArx
      </p>
      <h1 className="text-h1 mt-2">Blog</h1>
      <p className="text-body mt-3 max-w-2xl text-[var(--foreground-muted)]">
        Short essays on attention and studying. Each one ends in something you can do today.
      </p>
      <div className="mt-10 grid gap-4">
        {BLOG_POSTS.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="command-card block p-5"
          >
            <p className="text-xs text-[var(--foreground-subtle)]">
              {fmtDate(post.date)} · {post.readMin} min read
            </p>
            <h2 className="text-h3 mt-2">{post.h1}</h2>
            <p className="text-body mt-2 text-[var(--foreground-muted)]">{post.lead}</p>
            <span className="mt-3 inline-block text-sm font-semibold text-[var(--brand-strong)]">
              Read →
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-12">
        <Link
          href="/focus"
          className="inline-flex min-h-[44px] items-center rounded-full bg-[var(--brand-600)] px-6 font-semibold text-white"
        >
          Try the timer these essays are about
        </Link>
      </div>
    </div>
  );
}
