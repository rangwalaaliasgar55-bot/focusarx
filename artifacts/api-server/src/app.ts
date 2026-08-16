import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import compression from "compression";
import router from "./routes";
import { logger } from "./lib/logger";
import { getConfigErrors } from "./lib/config";
import { generalLimiter } from "./lib/rateLimiter";
import { masterSecurityMiddleware } from "./middlewares/security";

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
      if (!origin || isDev) { cb(null, true); return; }
      const allowed = [
        "https://focusarx.site",
        "https://focusarx.vercel.app",
        "https://focusarx-api.vercel.app"
      ];
      if (allowed.includes(origin) || origin.endsWith(".vercel.app")) {
        cb(null, true);
      } else {
        cb(new Error("CORS: origin not allowed"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

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
