import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getToken } from "@/lib/auth";
import { getTheme, applyTheme } from "@/lib/theme";

// Apply saved theme before first paint (prevents flash of wrong theme)
applyTheme(getTheme());

// Wire up the auth token so all Orval-generated hooks
// automatically attach Authorization: Bearer <token>
setAuthTokenGetter(() => getToken());

createRoot(document.getElementById("root")!).render(<App />);
