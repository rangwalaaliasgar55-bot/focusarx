import { useState } from "react";
import { useAuth, apiErrorMessage } from "@/lib/auth";
import { apiJson } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Account security: password change + account deletion.
 * Server contract:
 *   POST /api/auth/change-password  { currentPassword, newPassword }
 *   DELETE /api/auth/account        { password } (guests omit password)
 * Both endpoints clear auth cookies and revoke refresh sessions on success,
 * so the client signs out locally afterwards.
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
