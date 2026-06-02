import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getConfigErrors } from "./lib/config";
import { generalLimiter } from "./lib/rateLimiter";
const isDev = process.env.NODE_ENV !== "production";
const app: Express = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: isDev
          ? ["'self'", "http://localhost:*", "ws://localhost:*", "https:"]
          : ["'self'", "https:"],
        fontSrc: ["'self'", "data:", "https:"],
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
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) { cb(null, true); return; }
      if (isDev) { cb(null, true); return; }
      if (origin.endsWith(".vercel.app")) { cb(null, true); return; }
      if (origin.endsWith(".replit.dev") || origin.endsWith(".repl.co")) { cb(null, true); return; }
      const appUrl = process.env.APP_URL;
      if (appUrl) {
        const appUrlObj = new URL(appUrl);
        const originObj = new URL(origin);
        const baseDomain = appUrlObj.hostname.replace(/^www\./, "");
        const originDomain = originObj.hostname.replace(/^www\./, "");
        if (baseDomain === originDomain) { cb(null, true); return; }
      }
      cb(new Error("CORS: origin not allowed"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
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
