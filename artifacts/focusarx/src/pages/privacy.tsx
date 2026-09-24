import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { Shield, ArrowLeft } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { LegalFooter, PolicyBody } from "@/components/PolicyBody";
import { policySections } from "@/content/policy-pages.mjs";

export default function PrivacyPage() {
  return (
    <div className="relative min-h-[100dvh]">
      <PageSEO {...PAGE_SEO.privacy} />
      <main id="main-content" className="relative z-[var(--z-content)] mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[var(--foreground-subtle)] transition-colors hover:text-[var(--brand-400)]">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-soft)]">
                <Shield size={20} className="text-[var(--brand-400)]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">Legal</p>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Privacy Policy</h1>
              </div>
            </div>
            <p className="text-xs text-[var(--foreground-subtle)]">Last updated: August 2026</p>
          </header>

          <PolicyBody sections={policySections("/privacy")} />

          <LegalFooter />
        </PageTransition>
      </main>
    </div>
  );
}
