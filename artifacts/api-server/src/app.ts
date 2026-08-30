import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import compression from "compression";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import router from "./routes";
import { sitemapRouter } from "./routes/sitemap";
import { logger } from "./lib/logger";
import { getConfigErrors, getServerConfig } from "./lib/config";
import { getEnv } from "./lib/env";
import { generalLimiter } from "./lib/rateLimiter";
import { masterSecurityMiddleware } from "./middlewares/security";
import { deploymentVersionHeaders, deploymentSkewGuard } from "./middlewares/deploymentSkew";
import { isMaintenanceMode } from "./lib/siteSettings";

const isDev = getEnv().NODE_ENV !== "production";
const app: Express = express();
app.set("trust proxy", 1);

// Request ID middleware — must be early
app.use((req, _res, next) => {
  const existing = req.headers["x-request-id"] as string | undefined;
  const requestId = existing && existing.length < 128 ? existing : `req_${crypto.randomUUID()}`;
  (req as any).id = requestId;
  next();
});

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
        // ── AdSense ──────────────────────────────────────────────
        // The ad loader, its auction endpoint and the creative iframes all
        // live on *.googlesyndication.com / *.doubleclick.net. Without these
        // entries CSP blocked adsbygoogle.js outright, so the <ins> elements
        // rendered empty and the account saw zero impressions.
        scriptSrc: [
          "'self'", "'unsafe-inline'", "https://cdn.cookieyes.com",
          "https://pagead2.googlesyndication.com",
          "https://tpc.googlesyndication.com",
          "https://www.googletagservices.com",
          "https://www.google.com",
          "https://*.googleadservices.com",
          "https://*.googlesyndication.com",
          "https://*.doubleclick.net",
          "https://www.googletagmanager.com",
          "https://www.google-analytics.com",
          "https://ep2.adtrafficquality.google",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://*.googlesyndication.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "https://images.unsplash.com"],
        connectSrc: isDev
          ? ["'self'", "http://localhost:*", "ws://localhost:*", "https:"]
          : [
              "'self'", "https:", "wss:",
              "https://pagead2.googlesyndication.com",
              "https://*.googlesyndication.com",
              "https://*.doubleclick.net",
              "https://ep1.adtrafficquality.google",
              "https://ep2.adtrafficquality.google",
            ],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        mediaSrc: ["'self'", "blob:", "data:"],
        workerSrc: ["'self'", "blob:"],
        // Ad creatives render inside cross-origin iframes; 'none' killed them.
        frameSrc: [
          "https://*.googlesyndication.com",
          "https://*.doubleclick.net",
          "https://www.google.com",
          "https://*.google.com",
        ],
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
    genReqId: (req) => (req as any).id ?? `req_${crypto.randomUUID()}`,
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

// CORS — locked down in production
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (isDev) {
        cb(null, true);
        return;
      }

      let configured: string[] = [];
      try {
        const env = getEnv();
        configured = [
          getServerConfig().appUrl,
          env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null,
          env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
          ...(env.CORS_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? []),
          ...(process.env.CORS_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? []),
        ].filter((v): v is string => Boolean(v));
      } catch {
        configured = [
          getServerConfig().appUrl,
          process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
          process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
          ...(process.env.CORS_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? []),
        ].filter((v): v is string => Boolean(v));
      }

      const toOrigin = (url: string): string => {
        try {
          const u = new URL(url);
          return `${u.protocol}//${u.host}`;
        } catch {
          return url.replace(/\/+$/, "");
        }
      };

      const allowedOrigins = configured.map(toOrigin);
      const requestOrigin = toOrigin(origin);
      const isAllowed = allowedOrigins.includes(requestOrigin);

      if (isAllowed) {
        cb(null, true);
      } else {
        logger.warn({ origin, allowedOrigins }, "CORS origin rejected");
        cb(new Error("CORS: origin not allowed"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-Id", "X-FocusArx-Deployment", "Idempotency-Key"],
    exposedHeaders: ["X-Request-Id", "X-FocusArx-Deployment", "X-FocusArx-Deploy-Env"],
    maxAge: 86400,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use((req, _res, next) => {
  if (req.body === undefined || req.body === null) {
    (req as { body?: unknown }).body = {};
  }
  next();
});

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  const reqId = (_req as any).id;
  if (reqId) res.setHeader("X-Request-Id", reqId);
  next();
});

app.use("/api", generalLimiter);
// Deployment skew protection — attach version headers and guard mutations.
// Must run before route handlers so every response carries the version.
app.use("/api", deploymentVersionHeaders);
app.use("/api", deploymentSkewGuard);

/**
 * Endpoints that must keep answering during a configuration incident.
 *
 * `/healthz`     — the probe an operator (and Vercel) uses to see the server.
 * `/site/settings` — purely decorative (announcement bar, maintenance banner);
 *                    `getSiteSettings()` already degrades to defaults, so a
 *                    missing database must not turn the whole page into an
 *                    error state.
 * `/deployment`  — the frontend polls this to detect a new deployment. If it
 *                  503s during an incident, users are never told to refresh and
 *                  stay pinned to a stale bundle.
 * `/auth/session` — an anonymous session check needs no database lookup and
 *                  must still return the normal 401 rather than a config error.
 * `/track`       — best-effort telemetry has its own non-blocking 503 contract;
 *                  it must never become a core-product configuration failure.
 */
const CONFIG_GATE_EXEMPT_PREFIXES = ["/healthz", "/site/settings", "/deployment", "/auth/session", "/track"];

app.use("/api", (req, res, next) => {
  if (CONFIG_GATE_EXEMPT_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + "/"))) {
    next();
    return;
  }
  // getConfigErrors() introspects the environment. If that introspection ever
  // throws, the failure must not become an opaque 500 — the whole point of this
  // gate is to explain what is wrong, so it reports 503 with a pointer to the
  // logs instead.
  let missing: string[];
  try {
    missing = getConfigErrors();
  } catch (err) {
    logger.error({ err, requestId: (req as any).id }, "config gate failed");
    res.status(503).json({
      error: {
        code: "CONFIG_ERROR",
        message: "Server configuration could not be validated",
        hint: "Check the API server logs for [env] lines naming the invalid variable.",
        docs: "See docs/ENVIRONMENT.md",
        requestId: (req as any).id,
      },
    });
    return;
  }

  if (missing.length > 0) {
    res.status(503).json({
      error: {
        code: "CONFIG_ERROR",
        message: "Server is missing required configuration",
        missing,
        hint: "Fix these in your deployment's environment variables: " + missing.join(", "),
        docs: "See docs/ENVIRONMENT.md",
        requestId: (req as any).id,
      },
    });
    return;
  }
  next();
});

app.use("/api", async (req, res, next) => {
  const p = req.path;
  const isExempt =
    p === "/site/settings" ||
    p.startsWith("/admin/") ||
    p.startsWith("/auth/") ||
    p === "/healthz" ||
    p.startsWith("/healthz/");
  if (isExempt) {
    next();
    return;
  }
  try {
    if (await isMaintenanceMode()) {
      res.status(503).json({
        error: {
          code: "MAINTENANCE",
          message: "FocusArx is temporarily in maintenance mode",
          hint: "We're making things better — please check back in a few minutes.",
          requestId: (req as any).id,
        },
      });
      return;
    }
  } catch (err) {
    logger.warn({ err }, "maintenance check failed — allowing request");
  }
  next();
});

// ── SEO endpoints at the host root ────────────────────────────────
// Crawlers only ever look for /sitemap.xml and /robots.txt at the origin root,
// never under /api/. The same router is mounted twice so both work; vercel.json
// rewrites the root paths to this function (see the `routes` block).
app.use(sitemapRouter);

app.use("/api", router);

// Unknown /api/* paths. Without this, Express's built-in finalhandler answers
// with an HTML error page, which breaks every client that calls res.json() on
// the response and makes a typo'd endpoint look like a server crash.
app.use("/api", (req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Unknown API endpoint: ${req.method} ${req.path}`,
      requestId: (req as any).id,
    },
  });
});

// ── Centralized error handling ─────────────────────────────────────────────
// Standardized `{ error: { code, message, requestId } }` envelope for every
// failure path, with the original exception logged server-side only.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = (req as any).id ?? `req_${crypto.randomUUID()}`;

  if (err.message?.startsWith("CORS")) {
    res.status(403).json({
      error: {
        code: "CORS_FORBIDDEN",
        message: "Origin not allowed",
        requestId,
      },
    });
    return;
  }

  // Body-parser failures. express.json() rejects with these *before* any route
  // runs, so without this branch a client sending malformed JSON got a 500 —
  // which is both wrong (it is a client error) and indistinguishable from a
  // real server fault in the logs.
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    logger.warn({ requestId, url: req.url }, "malformed JSON request body");
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "The request body is not valid JSON",
        requestId,
      },
    });
    return;
  }

  if (err.type === "entity.too.large") {
    res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "The request body is too large",
        requestId,
      },
    });
    return;
  }

  // Zod validation errors
  if (err.name === "ZodError" || err.code === "VALIDATION_ERROR") {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request is invalid",
        requestId,
      },
    });
    return;
  }

  // Rate limit errors from express-rate-limit
  if (err.status === 429) {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests, please try again later",
        requestId,
      },
    });
    return;
  }

  // Errors that already carry a deliberate HTTP status (4xx from a helper that
  // threw rather than responded) keep that status instead of being flattened
  // into a 500.
  const errStatus = typeof err.status === "number" ? err.status : 0;
  if (errStatus >= 400 && errStatus < 500) {
    logger.warn({ err, requestId, url: req.url, method: req.method }, "client error");
    res.status(errStatus).json({
      error: {
        code: err.code ?? "BAD_REQUEST",
        message: typeof err.message === "string" && err.expose ? err.message : "The request could not be completed",
        requestId,
      },
    });
    return;
  }

  logger.error({ err, requestId, url: req.url, method: req.method }, "unhandled error");

  // Never expose stack traces, SQL errors, internal paths, API keys
  const isProd = getEnv().NODE_ENV === "production";
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      requestId,
      ...(isProd ? {} : { details: err.message }),
    },
  });
});

export default app;
