"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-sm font-semibold tracking-tight">
              FocusArx <span className="text-rose-400">Admin</span>
            </Link>
            <nav className="hidden gap-4 text-xs text-zinc-500 sm:flex">
              <Link href="/admin" className="hover:text-zinc-300">
                Users
              </Link>
              <Link href="/dashboard" className="hover:text-zinc-300">
                App dashboard
              </Link>
            </nav>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
          >
            Lock admin
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
