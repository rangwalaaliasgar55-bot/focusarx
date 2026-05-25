"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast(data.error || "Failed to create account", "error");
        setIsLoading(false);
        return;
      }
      
      // Auto-login after successful registration
      const loginRes = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });
      
      if (loginRes?.error) {
        toast("Account created but failed to log in", "error");
        router.push("/login");
      } else {
        toast("Account created successfully", "success");
        router.push("/dashboard");
      }
    } catch (err) {
      toast("Something went wrong. Please try again.", "error");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] p-8 shadow-2xl backdrop-blur-2xl">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight text-zinc-100">Create Account</h1>
        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400" htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
              placeholder="Your name (optional)"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400" htmlFor="email">Email</label>
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
            <label className="mb-1 block text-sm font-medium text-zinc-400" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
              placeholder="•••••••• (min 6 chars)"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-300 disabled:opacity-50"
          >
            {isLoading ? "Creating account..." : "Sign Up"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account? <Link href="/login" className="text-rose-400 hover:text-rose-300">Log in</Link>
        </p>
      </div>
    </div>
  );
}
