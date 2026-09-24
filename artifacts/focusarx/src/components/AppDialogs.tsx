import type { ReactNode } from "react";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { PromptProvider } from "@/components/ui/PromptDialog";

/**
 * Radix-backed dialogs are only needed on interactive product routes. Keeping
 * their providers in a lazy boundary avoids downloading modal infrastructure
 * for a read-only public landing page while preserving the accessible custom
 * prompts wherever the product exposes an action.
 */
export default function AppDialogs({ children }: { children: ReactNode }) {
  return (
    <ConfirmProvider>
      <PromptProvider>{children}</PromptProvider>
    </ConfirmProvider>
  );
}
