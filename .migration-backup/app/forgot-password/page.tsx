"use client";

import Link from "next/link";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset password"
      subtitle="Password reset is coming soon. For now, create a new account or continue as guest."
      footer={
        <p className="text-center text-sm text-zinc-500">
          <AuthLink href="/login">Back to sign in</AuthLink>
          {" · "}
          <Link href="/" className="text-zinc-600 hover:text-zinc-400">
            Timer
          </Link>
        </p>
      }
    >
      <p className="text-center text-sm text-zinc-400">
        We&apos;ll email you a reset link when this feature ships in a future update.
      </p>
    </AuthCard>
  );
}
