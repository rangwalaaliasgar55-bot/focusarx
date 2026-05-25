"use client";

import { SessionProvider } from "next-auth/react";
import { CapacitorNativeBridge } from "./CapacitorNativeBridge";
import { GuestBootstrap } from "./GuestBootstrap";
import { ToastProvider } from "./Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CapacitorNativeBridge />
      <GuestBootstrap />
      <ToastProvider>
        {children}
      </ToastProvider>
    </SessionProvider>
  );
}
