import { Link, useParams } from "wouter";
import { PageSEO } from "@/components/PageSEO";
import { BLOG_POSTS, getBlogPost } from "@/content/blog.mjs";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ContentTOC } from "@/components/ContentTOC";
import { AuthorBlock } from "@/components/AuthorBlock";
import { authorSchema, resolveAuthor } from "@/content/authors.mjs";
import { ClusterLinks } from "@/components/ClusterLinks";
import { headingAnchors } from "@/lib/heading-id.mjs";

/** Blog article (Phase 4.1 + Article JSON-LD via the prerender manifest). */
const FAQ_HEADING = "Frequently asked questions";

/**
 * Headings in document order, matching the list scripts/prerender.mjs builds for
 * the same post — sections first, then the FAQ heading when the post has one.
 */
function postTocHeadings(post: { sections: { h: string }[]; faq?: [string, string][] }) {
  const headings = post.sections.map((s) => s.h);
  if ((post.faq?.length ?? 0) > 0) headings.push(FAQ_HEADING);
  return headings;
}

function headingIdFor(post: { sections: { h: string }[]; faq?: [string, string][] }, heading: string) {
  return headingAnchors(postTocHeadings(post)).find((a) => a.label === heading)?.id;
}

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
        breadcrumbLabel={post.h1}
        structuredData={[
          // The same BlogPosting the prerendered document carries: author,
          // published date and modified date from the content, not the build.
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.h1,
            description: post.description,
            author: authorSchema(resolveAuthor(post.author)),
            publisher: {
              "@type": "Organization",
              name: "FocusArx",
              logo: {
                "@type": "ImageObject",
                url: "https://www.focusarx.site/logo.png",
              },
            },
            datePublished: post.date,
            dateModified: post.date,
            mainEntityOfPage: `https://www.focusarx.site/blog/${post.slug}`,
          },
        ]}
      />
      <Breadcrumbs path={`/blog/${post.slug}`} title={post.h1} />
      <AuthorBlock
        author={post.author}
        published={post.date}
        readMin={post.readMin}
        lastReviewed={post.date}
        className="mt-6"
      />
      <h1 className="text-h1 mt-2">{post.h1}</h1>
      <p className="text-body mt-4 max-w-2xl text-[17px] text-[var(--foreground-muted)]">{post.lead}</p>

      {/* Jump links. Headings are slugged by the same function the prerenderer
          uses, so an anchor works in the static document and after hydration. */}
      <ContentTOC headings={postTocHeadings(post)} className="mt-8 max-w-2xl" />

      {post.sections.map((s) => (
        <section key={s.h} className="mt-8 max-w-2xl">
          <h2 id={headingIdFor(post, s.h)} className="text-h3">{s.h}</h2>
          <p className="text-body mt-2 text-[var(--foreground-muted)]">{s.p}</p>
        </section>
      ))}
      {(post.faq?.length ?? 0) > 0 && (
        <section className="mt-10 max-w-2xl" aria-labelledby="blog-faq-heading">
          <h2 id={headingIdFor(post, FAQ_HEADING)} className="text-h3">{FAQ_HEADING}</h2>
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

      <ClusterLinks
        path={`/blog/${post.slug}`}
        exclude={(post.related ?? []).map((pair: string) => String(pair).split("|")[0])}
        className="mt-10"
      />

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
