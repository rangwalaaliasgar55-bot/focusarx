import { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, LockKeyhole, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AdminGate({ onUnlocked }: { onUnlocked?: () => void }) {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setLoading(true);
    try {
      const response = await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ password }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(response.status === 503 ? "Set ADMIN_PASSWORD in the environment before opening admin." : response.status === 401 || response.status === 403 ? "That password is not valid." : data.error ?? "Admin access was denied.");
        return;
      }
      if (onUnlocked) onUnlocked();
      else { navigate("/admin"); window.location.reload(); }
    } catch { setError("FocusArx could not reach the admin service. Check the connection and try again."); }
    finally { setLoading(false); }
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[var(--background)] px-4 py-12">
      <Card elevation="elevated" className="w-full max-w-md">
        <CardContent className="p-7 sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-[var(--radius-lg)] bg-[var(--danger-soft)] text-[var(--danger)]"><Shield /></span>
          <p className="page-eyebrow mt-6">Restricted area</p><h1 className="text-2xl font-semibold tracking-tight">Admin access</h1><p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">Enter the admin password to open the FocusArx command center.</p>
          <form onSubmit={submit} className="mt-6">
            {error && <p className="mb-4 flex gap-2 rounded-lg bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={16} />{error}</p>}
            <label htmlFor="admin-password" className="mb-2 block text-sm font-medium">Password</label>
            <Input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" leftSlot={<LockKeyhole />} error={!!error} autoFocus required />
            <Button type="submit" className="mt-5 w-full" size="lg" loading={loading}>Unlock admin</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
