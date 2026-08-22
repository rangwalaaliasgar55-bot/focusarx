import { Link } from "wouter";
import { ArrowLeft, ShieldCheck, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthLayout({ eyebrow, title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--background)] px-4 py-12">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[52rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--brand-soft-hover),transparent_70%)] blur-3xl" />
      <div className="relative z-[var(--z-content)] w-full max-w-md">
        <div className="mb-7 flex items-center justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"><ArrowLeft size={16} /> Home</Link>
          <span className="inline-flex items-center gap-2 text-xs text-[var(--foreground-subtle)]"><ShieldCheck size={14} /> Secure access</span>
        </div>
        <div className="mb-6 text-center">
          <span className="brand-mark mx-auto"><Zap size={18} fill="currentColor" /></span>
          <p className="mt-3 text-sm font-semibold">FocusArx</p>
        </div>
        <Card elevation="elevated" className="overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <p className="page-eyebrow">{eyebrow}</p>
            <h1 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--foreground)]">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </CardContent>
        </Card>
        <div className="mt-6 text-center text-sm text-[var(--foreground-muted)]">{footer}</div>
      </div>
    </main>
  );
}
