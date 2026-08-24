import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import compression from "compression";
import router from "./routes";
import { logger } from "./lib/logger";
import { getConfigErrors, getServerConfig } from "./lib/config";
import { generalLimiter } from "./lib/rateLimiter";
import { masterSecurityMiddleware } from "./middlewares/security";
import { isMaintenanceMode } from "./lib/siteSettings";

const isDev = process.env.NODE_ENV !== "production";
const app: Express = express();
app.set("trust proxy", 1);

app.use(masterSecurityMiddleware);
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.cookieyes.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:", "https://images.unsplash.com"],
        connectSrc: isDev
          ? ["'self'", "http://localhost:*", "ws://localhost:*", "https:"]
          : ["'self'", "https:", "wss:"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        mediaSrc: ["'self'", "blob:", "data:"],
        workerSrc: ["'self'", "blob:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isDev ? null : [],
      },
    },
    crossOriginEmbedderPolicy: false,
    permissionsPolicy: {
      features: {
        camera: ["self"],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        accelerometer: [],
        gyroscope: [],
        magnetometer: [],
      },
    },
  } as Parameters<typeof helmet>[0]),
);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(
  cors({
    origin: (origin, cb) => {
      // No Origin header (curl, server-to-server, same-origin GET) — allow.
      if (!origin || isDev) { cb(null, true); return; }

      // Build the allowlist dynamically so the API keeps working no matter
      // where the frontend is hosted (Vercel, Replit, localhost, custom domain).
      const configured = [
        getServerConfig().appUrl,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
        ...(process.env.CORS_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()) ?? []),
      ].filter((v): v is string => Boolean(v));

      // Normalize a URL to a bare `https://host` origin for comparison.
      const toOrigin = (url: string): string => {
        try {
          const u = new URL(url);
          return `${u.protocol}//${u.host}`;
        } catch {
          return url.replace(/\/+$/, "");
        }
      };

      const allowedOrigins = configured.map(toOrigin);
      const isAllowed = allowedOrigins.includes(toOrigin(origin));

      if (isAllowed) {
        cb(null, true);
      } else {
        // Log the rejected origin so misconfigurations are easy to diagnose.
        logger.warn({ origin, allowedOrigins }, "CORS origin rejected");
        cb(new Error("CORS: origin not allowed"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// Express 5 leaves `req.body` as `undefined` when a request arrives with no
// body (DELETE/GET with no payload, or an empty request). Route handlers
// destructure it directly (`const { x } = req.body as ...`), which throws a
// TypeError and surfaces as an opaque 500 "Internal error" — e.g.
// DELETE /api/push/subscribe with no body. Normalising here means no handler
// can 500 purely because the client sent nothing.
app.use((req, _res, next) => {
  if (req.body === undefined || req.body === null) {
    (req as { body?: unknown }).body = {};
  }
  next();
});

// Add security headers for all responses
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use("/api", generalLimiter);
app.use("/api", (req, res, next) => {
  if (req.path === "/healthz" || req.path.startsWith("/healthz/")) {
    next();
    return;
  }
  const missing = getConfigErrors();
  if (missing.length > 0) {
    res.status(503).json({
      error: "Server is missing required configuration",
      missing,
      hint: "Add these in your environment variables: " + missing.join(", "),
    });
    return;
  }
  next();
});
// Maintenance-mode gate: when enabled, block everything except the public
// settings endpoint (so the frontend can render the maintenance screen), the
// admin panel (so an admin can turn it off), auth (so the admin can log in),
// and health checks.
app.use("/api", async (req, res, next) => {
  const p = req.path;
  const isExempt =
    p === "/site/settings" ||
    p.startsWith("/admin/") ||
    p.startsWith("/auth/") ||
    p === "/healthz" ||
    p.startsWith("/healthz/");
  if (isExempt) { next(); return; }
  try {
    if (await isMaintenanceMode()) {
      res.status(503).json({
        error: "FocusArx is temporarily in maintenance mode",
        hint: "We're making things better — please check back in a few minutes.",
      });
      return;
    }
  } catch (err) {
    logger.warn({ err }, "maintenance check failed — allowing request");
  }
  next();
});
app.use("/api", router);
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.message?.startsWith("CORS")) {
    res.status(403).json({ error: "Forbidden", reason: err.message });
    return;
  }
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: "Internal error" });
});
export default app;
