"use client";

import { useEffect } from "react";

export function CapacitorNativeBridge() {
  useEffect(() => {
    let mounted = true;

    async function configureNativeShell() {
      const [
        { Capacitor },
        { SplashScreen },
        { StatusBar, Style },
        { Keyboard, KeyboardResize },
      ] =
        await Promise.all([
          import("@capacitor/core"),
          import("@capacitor/splash-screen"),
          import("@capacitor/status-bar"),
          import("@capacitor/keyboard"),
        ]);

      if (!mounted || !Capacitor.isNativePlatform()) return;

      document.documentElement.classList.add("capacitor-native");

      await Promise.allSettled([
        StatusBar.setStyle({ style: Style.Dark }),
        StatusBar.setBackgroundColor({ color: "#09090b" }),
        StatusBar.setOverlaysWebView({ overlay: false }),
        Keyboard.setResizeMode({ mode: KeyboardResize.Body }),
        SplashScreen.hide(),
      ]);
    }

    void configureNativeShell().catch((err) => {
      console.warn("[capacitor] native shell setup failed", err);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
