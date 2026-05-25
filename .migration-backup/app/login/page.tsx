"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useToast } from "@/components/Toast";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setIsLoading(false);

    if (res?.error) {
      toast("Invalid email or password", "error");
    } else {
      toast("Logged in successfully", "success");
      router.push("/dashboard");
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to sync sessions and analytics"
      footer={
        <>
          <p className="text-center text-sm text-zinc-500">
            Don&apos;t have an account? <AuthLink href="/signup">Sign up</AuthLink>
          </p>
          <p className="mt-3 text-center text-xs text-zinc-600">
            <AuthLink href="/forgot-password">Forgot password?</AuthLink>
            {" · "}
            <Link href="/" className="hover:text-zinc-400">
              Continue as guest
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            placeholder="••••••••"
          />
        </div>
        <motion.button
          type="submit"
          disabled={isLoading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-2 rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-300 disabled:opacity-50"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </motion.button>
      </form>
    </AuthCard>
  );
}
