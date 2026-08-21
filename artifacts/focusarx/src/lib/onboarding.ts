/**
 * Shared onboarding + modal-coordination helpers.
 *
 * The goal: a first-time visitor should see ONE necessary flow (onboarding)
 * plus the legally-required cookie notice — never a stack of competing
 * popups. These helpers let each transient surface coordinate so at most one
 * full-screen modal is visible at a time, and so the daily nags (daily reward,
 * readiness check-in, missed-task review) only ever run after onboarding.
 */

const ONBOARDING_KEY = "onboardingComplete";

export function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

/**
 * A tiny cross-component lock (module singleton) so full-screen modals don't
 * stack. Call `tryAcquireModal()` before showing, and `releaseModal()` when
 * the modal closes. Returns false when another modal already owns the lock.
 */
let modalActive = false;

export function tryAcquireModal(): boolean {
  if (modalActive) return false;
  modalActive = true;
  return true;
}

export function releaseModal(): void {
  modalActive = false;
}
