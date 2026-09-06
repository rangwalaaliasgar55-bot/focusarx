import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSEO } from "@/components/PageSEO";
import { PAGE } from "@/lib/animations";

/**
 * `noindex`, and no title that could pass for a real page.
 *
 * vercel.json answers an unknown URL by serving the SPA shell with status 200 (the
 * rewrite happens after `handle: filesystem`, and the app owns client routing), so
 * this component is the *only* thing standing between a mistyped link and a
 * duplicate of the homepage's metadata in the index — the soft-404 case Google
 * documents as wasted crawl plus confused canonicals. A real 404 status would need
 * an edge function for every page view, which is not worth the latency here; what
 * is worth it is telling crawlers plainly that there is nothing at this address.
 */
export default function NotFound() {
  return (
    <div className="relative min-h-screen overflow-hidden forge-bg-glow flex items-center justify-center px-4">
      <PageSEO
        title="Page not found"
        description="That FocusArx page does not exist. Start from the focus timer, the study guides, or the changelog."
        noindex
      />
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 z-[var(--z-base)]" aria-hidden>
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-124-58-237-0_10),transparent_65%)] blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-6-214-160-0_06),transparent_65%)] blur-3xl" />
      </div>

      <motion.div
        variants={PAGE}
        initial="initial"
        animate="animate"
        className="relative z-[var(--z-content)] text-center max-w-md"
      >
        {/* 404 number */}
        <div className="relative mb-6 inline-block">
          <span className="font-metric text-[8rem] font-bold leading-none select-none"
            style={{
              background: "linear-gradient(135deg, var(--rgba-124-58-237-0_25), var(--rgba-167-139-250-0_15))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            404
          </span>
          {/* Floating icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-2xl)] bg-gradient-to-br from-[var(--brand-violet)] to-[var(--palette-4f46e5)] shadow-[var(--shadow-violet-lg)]">
              <Zap size={26} className="text-[var(--palette-white)]" fill="var(--palette-white)" />
            </div>
          </div>
        </div>

        <h1 className="text-h2 text-[var(--foreground)] mb-3">Page not found</h1>
        <p className="text-[var(--foreground-muted)] mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button size="lg" variant="glow">
              <Zap className="size-4" />
              Go to Dashboard
            </Button>
          </Link>
          <Button
            size="lg"
            variant="outline"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="size-4" />
            Go back
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
