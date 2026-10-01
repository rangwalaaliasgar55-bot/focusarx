import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth, apiErrorMessage } from "@/lib/auth";
import { apiJson } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Two-factor authentication (TOTP).
 *
 * Server contract (§1.2):
 *   GET  /api/auth/2fa/status            { enabled, enrolmentPending, backupCodesRemaining }
 *   POST /api/auth/2fa/register          { } → { qrDataUrl, otpauthUri }
 *   POST /api/auth/2fa/register/confirm  { code } → { backupCodes: string[] }
 *   POST /api/auth/2fa/disable           { password, code }
 *   POST /api/auth/2fa/backup-codes      { code } → { backupCodes: string[] }
 *
 * Enrolment is two-phase: the QR is only a *proposal* until a code from it is
 * confirmed, which is why the switch never flips on before the confirm call
 * succeeds. Backup codes are shown exactly once — the server stores only
 * SHA-256 digests, so this component is the last place the plaintexts exist.
 */
type TwoFactorStatus = { enabled: boolean; enrolmentPending: boolean; backupCodesRemaining: number };

function TwoFactorSection({ disabledForGuest }: { disabledForGuest: boolean }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [enrolling, setEnrolling] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [enrolError, setEnrolError] = useState<string | null>(null);

  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  const [regenCode, setRegenCode] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  useEffect(() => {
    if (disabledForGuest) return;
    let cancelled = false;
    apiJson<TwoFactorStatus>("/api/auth/2fa/status")
      .then((data) => { if (!cancelled) setStatus(data); })
      .catch((err) => { if (!cancelled) setStatusError(apiErrorMessage(err, "Could not load two-factor status.")); });
    return () => { cancelled = true; };
  }, [disabledForGuest]);

  async function startEnrolment() {
    setEnrolError(null);
    setEnrolling(true);
    try {
      const data = await apiJson<{ qrDataUrl: string; otpauthUri: string }>("/api/auth/2fa/register", { method: "POST" });
      setQrDataUrl(data.qrDataUrl);
      setOtpauthUri(data.otpauthUri);
    } catch (err) {
      setEnrolError(apiErrorMessage(err, "Could not start enrolment. This deployment may not have two-factor configured."));
    } finally {
      setEnrolling(false);
    }
  }

  async function confirmEnrolment(e: React.FormEvent) {
    e.preventDefault();
    setEnrolError(null);
    if (!/^\d{6}$/.test(confirmCode.trim())) {
      setEnrolError("Enter the 6-digit code your authenticator app shows.");
      return;
    }
    setConfirming(true);
    try {
      const data = await apiJson<{ backupCodes: string[] }>("/api/auth/2fa/register/confirm", {
        method: "POST",
        body: JSON.stringify({ code: confirmCode.trim() }),
      });
      setQrDataUrl(null);
      setOtpauthUri(null);
      setConfirmCode("");
      setBackupCodes(data.backupCodes);
      setStatus((s) => s ? { ...s, enabled: true, enrolmentPending: false, backupCodesRemaining: data.backupCodes.length } : s);
      toast("Two-factor authentication is on.", "success");
    } catch (err) {
      setEnrolError(apiErrorMessage(err, "That code was not accepted — check your authenticator and try again."));
    } finally {
      setConfirming(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisableError(null);
    setDisabling(true);
    try {
      await apiJson("/api/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password: disablePassword, code: disableCode.trim() }),
      });
      setDisableOpen(false);
      setDisablePassword("");
      setDisableCode("");
      setStatus((s) => s ? { ...s, enabled: false, backupCodesRemaining: 0 } : s);
      toast("Two-factor authentication is off.", "success");
    } catch (err) {
      setDisableError(apiErrorMessage(err, "Could not disable. Check your password and code, then try again."));
    } finally {
      setDisabling(false);
    }
  }

  async function handleRegenerate(e: React.FormEvent) {
    e.preventDefault();
    setRegenError(null);
    if (!/^\d{6}$/.test(regenCode.trim())) {
      setRegenError("Enter the 6-digit code your authenticator app shows.");
      return;
    }
    setRegenerating(true);
    try {
      const data = await apiJson<{ backupCodes: string[] }>("/api/auth/2fa/backup-codes", {
        method: "POST",
        body: JSON.stringify({ code: regenCode.trim() }),
      });
      setRegenCode("");
      setBackupCodes(data.backupCodes);
      setStatus((s) => s ? { ...s, backupCodesRemaining: data.backupCodes.length } : s);
    } catch (err) {
      setRegenError(apiErrorMessage(err, "Could not regenerate backup codes."));
    } finally {
      setRegenerating(false);
    }
  }

  function copyBackupCodes() {
    if (!backupCodes) return;
    void navigator.clipboard?.writeText(backupCodes.join("\n")).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  if (disabledForGuest) return null;

  return (
    <section aria-label="Two-factor authentication" className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} /> Two-factor authentication</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {statusError
              ? "Status unavailable."
              : status?.enabled
                ? `Active. ${status.backupCodesRemaining} backup ${status.backupCodesRemaining === 1 ? "code" : "codes"} left.`
                : status
                  ? "Add a second step to sign-in with an authenticator app."
                  : "Checking…"}
          </p>
        </div>
        <Switch
          checked={Boolean(status?.enabled)}
          disabled={!status || status.enabled || enrolling}
          onCheckedChange={() => { if (!status?.enabled) void startEnrolment(); }}
          aria-label="Enable two-factor authentication"
        />
      </div>

      {statusError && <p role="alert" className="text-sm text-[var(--palette-red-500)]">{statusError}</p>}
      {enrolError && <p role="alert" className="text-sm text-[var(--palette-red-500)]">{enrolError}</p>}

      {qrDataUrl && (
        <form onSubmit={confirmEnrolment} className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4">
          <p className="text-sm text-[var(--text-muted)]">
            Scan this with your authenticator app (Google Authenticator, 1Password, Authy…), then confirm with the code it shows.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* Explicit dimensions: the SEO gate flags <img> without them. */}
            <img src={qrDataUrl} alt="Two-factor enrolment QR code" width={220} height={220} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)]" />
            {otpauthUri && (
              <p className="max-w-full break-all font-mono text-[11px] leading-relaxed text-[var(--text-muted)]">{otpauthUri}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totp-confirm">Authenticator code</Label>
            <Input
              id="totp-confirm"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              placeholder="123456"
              className="max-w-[12rem]"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={confirming}>{confirming ? "Verifying…" : "Confirm and enable"}</Button>
            <Button type="button" variant="outline" onClick={() => { setQrDataUrl(null); setOtpauthUri(null); setConfirmCode(""); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {backupCodes && (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted,transparent)] p-4">
          <div>
            <p className="text-sm font-semibold">Save your backup codes now.</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Each works once, with or without your phone. They are never shown again.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm sm:grid-cols-4">
            {backupCodes.map((code) => <li key={code}>{code}</li>)}
          </ul>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={copyBackupCodes}>{copied ? "Copied" : "Copy codes"}</Button>
            <Button type="button" variant="ghost" onClick={() => setBackupCodes(null)}>I saved them</Button>
          </div>
        </div>
      )}

      {status?.enabled && !backupCodes && (
        <form onSubmit={handleRegenerate} className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4">
          <p className="text-sm text-[var(--text-muted)]">
            Used up or lost your backup codes? Generate a fresh set — the old ones stop working.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="totp-regen" className="sr-only">Authenticator code</Label>
              <Input
                id="totp-regen"
                inputMode="numeric"
                maxLength={6}
                value={regenCode}
                onChange={(e) => setRegenCode(e.target.value)}
                placeholder="123456"
                className="w-[10rem]"
              />
            </div>
            <Button type="submit" variant="outline" disabled={regenerating}>{regenerating ? "Generating…" : "Regenerate codes"}</Button>
          </div>
          {regenError && <p role="alert" className="text-sm text-[var(--palette-red-500)]">{regenError}</p>}
        </form>
      )}

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn off two-factor authentication?</DialogTitle>
            <DialogDescription>
              Your password alone will sign you in again. Confirm with your password plus a current code — a password alone is exactly what this feature exists to protect.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDisable} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="totp-disable-password">Password</Label>
              <Input id="totp-disable-password" type="password" autoComplete="current-password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="totp-disable-code">Authenticator or backup code</Label>
              <Input id="totp-disable-code" inputMode="numeric" autoComplete="one-time-code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
            </div>
            {disableError && <p role="alert" className="text-sm text-[var(--palette-red-500)]">{disableError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDisableOpen(false)} disabled={disabling}>Keep it on</Button>
              <Button type="submit" variant="destructive" disabled={disabling}>{disabling ? "Disabling…" : "Turn off"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {status?.enabled && !backupCodes && (
        <Button type="button" variant="outline" onClick={() => { setDisableOpen(true); setDisableError(null); }}>
          Turn off…
        </Button>
      )}
    </section>
  );
}

/**
 * Account security: two-factor authentication + password change + deletion.
 * Server contract:
 *   POST /api/auth/change-password  { currentPassword, newPassword }
 *   DELETE /api/auth/account        { password } (guests omit password)
 * Both endpoints clear auth cookies and revoke refresh sessions on success,
 * so the client signs out locally afterwards. Two-factor management lives in
 * TwoFactorSection above and talks to /api/auth/2fa/*.
 */
export function AccountSecuritySection() {
  const { data, signOut, refresh } = useAuth();
  const { toast } = useToast();
  const user = data?.user ?? null;
  const isGuest = Boolean(user?.isGuest);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const passwordCapable = Boolean(user && !isGuest);
  const pendingDeletion = data?.pendingDeletion ?? null;

  /**
   * Undo a scheduled deletion.
   *
   * The account still authenticates during the window — that is what makes this
   * possible at all. A grace period that also signs you out irreversibly is not
   * a grace period, it is a two-step delete.
   */
  async function handleCancelDeletion() {
    setCancelling(true);
    try {
      await apiJson("/api/auth/account/deletion/cancel", { method: "POST" });
      toast("Deletion cancelled — your account and history are safe.", "success");
      await refresh();
    } catch (err) {
      toast(apiErrorMessage(err, "Could not cancel the deletion. Please try again."), "error");
    } finally {
      setCancelling(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangeError(null);
    if (newPassword.length < 8) {
      setChangeError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError("New passwords do not match.");
      return;
    }
    setChanging(true);
    try {
      await apiJson("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast("Password updated — all other sessions were signed out. Please sign in again.", "success");
      await signOut();
    } catch (err) {
      setChangeError(apiErrorMessage(err, "Could not update password. Check your current password and try again."));
    } finally {
      setChanging(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      setDeleteError('Type "DELETE" to confirm.');
      return;
    }
    setDeleting(true);
    try {
      const result = await apiJson<{ deleted: boolean; daysRemaining?: number }>("/api/auth/account", {
        method: "DELETE",
        body: JSON.stringify(isGuest ? {} : { password: deletePassword }),
      });
      // The copy used to say "permanently removed" for both cases. For a
      // scheduled deletion that is simply untrue, and it is the kind of untrue
      // that stops someone from signing back in to undo it.
      toast(
        result.deleted
          ? "Guest profile deleted — it was never stored against an email address."
          : `Deletion scheduled. Your account is kept for ${result.daysRemaining ?? 30} more days — sign in any time before then to cancel.`,
        "success",
      );
      await signOut();
    } catch (err) {
      setDeleteError(apiErrorMessage(err, "Could not delete the account. Check your password and try again."));
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account &amp; security</CardTitle>
        <CardDescription>
          {isGuest
            ? "You are using a guest profile — no password is set."
            : "Change your password or permanently delete your account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {passwordCapable && (
          <form onSubmit={handleChangePassword} className="space-y-3" aria-label="Change password">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            {changeError && (
              <p role="alert" className="text-sm text-[var(--palette-red-500)]">{changeError}</p>
            )}
            <Button type="submit" disabled={changing}>
              {changing ? "Updating…" : "Update password"}
            </Button>
            <p className="text-xs text-[var(--text-muted)]">
              Updating your password signs out every device. You will need to sign in again.
            </p>
          </form>
        )}

        <TwoFactorSection disabledForGuest={isGuest} />

        <div className="rounded-[var(--radius-md)] border border-[var(--palette-red-500-30)] bg-[var(--palette-red-500-05)] p-4">
          <h3 className="text-sm font-semibold text-[var(--palette-red-500)]">Danger zone</h3>
          {pendingDeletion ? (
            <>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Your account is scheduled for deletion on{" "}
                <strong className="text-[var(--foreground)]">
                  {new Date(pendingDeletion.scheduledFor).toLocaleDateString(undefined, {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </strong>
                {pendingDeletion.daysRemaining === 1
                  ? " — 1 day left to change your mind."
                  : ` — ${pendingDeletion.daysRemaining} days left to change your mind.`}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Nothing has been removed yet. Cancelling restores everything exactly as it is now.
              </p>
              {pendingDeletion.cancellable ? (
                <Button className="mt-3" onClick={() => void handleCancelDeletion()} disabled={cancelling}>
                  {cancelling ? "Cancelling…" : "Keep my account"}
                </Button>
              ) : (
                // The window has lapsed but the purge job has not run yet.
                // There is nothing honest to offer here.
                <p className="mt-3 text-sm font-medium text-[var(--palette-red-500)]">
                  The recovery window has closed. The account will be removed shortly.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {isGuest
                  ? "Delete this guest profile and everything saved to it. Guest profiles are not linked to an email address, so there is no way to recover one."
                  : "Delete your account, sessions, progress, and rewards. Your data is kept for 30 days so you can change your mind — nothing is removed straight away."}
              </p>
              <Button
                variant="destructive"
                className="mt-3"
                onClick={() => { setDeleteOpen(true); setDeleteError(null); }}
              >
                Delete account…
              </Button>
            </>
          )}
        </div>
      </CardContent>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              {isGuest
                ? "This guest profile and everything in it is removed immediately and cannot be recovered."
                : "We will keep your profile, focus history, XP, coins and streaks for 30 days, then remove them. You can sign in and cancel at any point before then."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!isGuest && (
              <div className="space-y-1.5">
                <Label htmlFor="delete-password">Confirm your password</Label>
                <Input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">
                Type <span className="font-mono font-semibold">DELETE</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
            {deleteError && (
              <p role="alert" className="text-sm text-[var(--palette-red-500)]">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? "Deleting…" : isGuest ? "Delete permanently" : "Schedule deletion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
