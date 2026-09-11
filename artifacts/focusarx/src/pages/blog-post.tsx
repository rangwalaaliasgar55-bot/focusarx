import { Link, useParams } from "wouter";
import { PageSEO } from "@/components/PageSEO";
import { BLOG_POSTS, getBlogPost } from "@/content/blog.mjs";
import { fmtDate } from "@/lib/locale";

/** Blog article (Phase 4.1 + Article JSON-LD via the prerender manifest). */
export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = getBlogPost(slug ?? "");
  // Two sibling essays, newest first, so the block never repeats the same order
  // on every post and never links the post to itself.
  const relatedPosts = BLOG_POSTS.filter((other) => other.slug !== slug)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 2);

  if (!post) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-4 py-16 sm:px-6">
        <PageSEO title="Post not found | FocusArx Blog" description="That post does not exist." noindex />
        <h1 className="text-h1">Post not found</h1>
        <p className="text-body mt-3 text-[var(--foreground-muted)]">That essay is not here.</p>
        <Link href="/blog" className="mt-6 inline-block font-semibold text-[var(--brand-strong)]">
          ← All essays
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-16 sm:px-6">
      <PageSEO
        title={post.title}
        description={post.description}
        canonical={`/blog/${post.slug}`}
      />
      <Link href="/blog" className="text-sm font-semibold text-[var(--brand-strong)]">
        ← Blog
      </Link>
      <p className="mt-6 text-xs text-[var(--foreground-subtle)]">
        {fmtDate(post.date)} · {post.readMin} min read
      </p>
      <h1 className="text-h1 mt-2">{post.h1}</h1>
      <p className="text-body mt-4 max-w-2xl text-[17px] text-[var(--foreground-muted)]">{post.lead}</p>
      {post.sections.map((s) => (
        <section key={s.h} className="mt-8 max-w-2xl">
          <h2 className="text-h3">{s.h}</h2>
          <p className="text-body mt-2 text-[var(--foreground-muted)]">{s.p}</p>
        </section>
      ))}
      {(post.faq?.length ?? 0) > 0 && (
        <section className="mt-10 max-w-2xl" aria-label="Questions">
          <h2 className="text-h3">Questions</h2>
          {(post.faq ?? []).map(([q, a]) => (
            <div key={q} className="mt-4">
              <h3 className="text-h4">{q}</h3>
              <p className="text-body mt-1 text-[var(--foreground-muted)]">{a}</p>
            </div>
          ))}
        </section>
      )}
      {/* Related reading: the other essays plus the tools and guides this one
          argues for. A post that ends in a dead link back to the index keeps its
          readers and its link equity to itself; this is what turns one article
          into an entry point. */}
      {relatedPosts.length > 0 && (
        <section className="mt-12 max-w-2xl" aria-labelledby="related-essays">
          <h2 id="related-essays" className="text-h3">Related essays</h2>
          <ul className="mt-4 grid gap-3">
            {relatedPosts.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/blog/${other.slug}`}
                  className="block min-h-[44px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition-colors hover:border-[var(--card-border)]"
                >
                  <span className="block text-sm font-semibold text-[var(--foreground)]">{other.h1}</span>
                  <span className="mt-1 block text-xs text-[var(--foreground-muted)]">{other.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(post.related?.length ?? 0) > 0 && (
        <section className="mt-10 max-w-2xl" aria-labelledby="related-tools">
          <h2 id="related-tools" className="text-h3">Try it now</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {(post.related ?? []).map((pair: string) => {
              const [href, label] = String(pair).split("|");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--border)] px-4 text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:border-[var(--card-border)] hover:text-[var(--foreground)]"
                  >
                    {label || href}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-12">
        <Link
          href="/focus"
          className="inline-flex min-h-[44px] items-center rounded-full bg-[var(--brand-600)] px-6 font-semibold text-white"
        >
          Start a 25-minute session
        </Link>
      </div>
    </div>
  );
}
