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
  const { data, signOut } = useAuth();
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

  const passwordCapable = Boolean(user && !isGuest);

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
      await apiJson("/api/auth/account", {
        method: "DELETE",
        body: JSON.stringify(isGuest ? {} : { password: deletePassword }),
      });
      toast("Account deleted — your data has been permanently removed.", "success");
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
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Permanently delete your account, sessions, progress, and rewards. This cannot be undone.
          </p>
          <Button
            variant="destructive"
            className="mt-3"
            onClick={() => { setDeleteOpen(true); setDeleteError(null); }}
          >
            Delete account…
          </Button>
        </div>
      </CardContent>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your profile, focus history, XP, coins, streaks, and rewards.
              This action cannot be undone.
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
              {deleting ? "Deleting…" : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
