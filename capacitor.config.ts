import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const isCleartextServer = serverUrl?.startsWith("http://") ?? false;

const config: CapacitorConfig = {
  appId: "com.focusarx.app",
  appName: "FocusArx",
  webDir: "out",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: isCleartextServer,
      }
    : undefined,
  android: {
    allowMixedContent: isCleartextServer,
    captureInput: true,
    webContentsDebuggingEnabled:
      process.env.CAPACITOR_WEBVIEW_DEBUG === "true",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: "#09090b",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      style: KeyboardStyle.Dark,
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_focusarx",
      iconColor: "#f43f5e",
    },
  },
};

export default config;
