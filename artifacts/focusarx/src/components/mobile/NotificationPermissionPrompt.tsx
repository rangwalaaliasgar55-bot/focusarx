"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, X, Check } from "lucide-react";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useToast } from "@/components/Toast";

export function NotificationPermissionPrompt() {
  const { permission, showSoftPrompt, isDefault, requestPermission, dismissSoftPrompt } = useNotificationPermission();
  const { toast } = useToast();

  if (!showSoftPrompt || !isDefault) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[var(--z-modal)] md:bottom-6 md:left-auto md:right-6 md:w-full md:max-w-sm"
      >
        <div className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={dismissSoftPrompt}
            className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-[var(--surface-hover)] text-[var(--foreground-subtle)]"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-500)]">
              <Bell size={18} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Never miss a break?</h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">
                Get a gentle notification when your focus session ends — even if the app is in background. You can turn it off anytime in Settings.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await requestPermission();
                    if (res === "granted") toast("Notifications enabled — we'll alert you when sessions end", "success");
                    else if (res === "denied") toast("Notifications blocked in browser settings", "error");
                  }}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--brand-600)] px-4 text-sm font-bold text-white"
                >
                  <Check size={16} />
                  Enable
                </button>
                <button
                  type="button"
                  onClick={dismissSoftPrompt}
                  className="min-h-[44px] rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 text-sm font-medium"
                >
                  Not now
                </button>
              </div>
              <p className="mt-2 text-[10px] text-[var(--foreground-subtle)]">
                We only send session alerts, no spam. You can change this in Settings → Notifications.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Settings page toggle component - explains value first
export function NotificationSettingsCard() {
  const { permission, isGranted, isDenied, requestPermission } = useNotificationPermission();
  const { toast } = useToast();

  if (permission === "unsupported") {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
        <p className="text-sm font-medium">Notifications</p>
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">Your browser doesn't support notifications.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Session notifications</p>
          <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
            {isGranted ? "Enabled — you'll be notified when focus sessions end" : isDenied ? "Blocked — enable in browser settings" : "Get notified when sessions complete, even in background"}
          </p>
        </div>
        {isGranted ? (
          <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-bold text-[var(--success)]">Enabled</span>
        ) : (
          <button
            type="button"
            onClick={async () => {
              const res = await requestPermission();
              if (res === "granted") toast("Notifications enabled", "success");
              else if (res === "denied") toast("Notifications blocked — check browser settings", "error");
            }}
            className="min-h-[36px] rounded-full bg-[var(--brand-600)] px-4 text-xs font-bold text-white"
          >
            {isDenied ? "Open settings" : "Enable"}
          </button>
        )}
      </div>
    </div>
  );
}
