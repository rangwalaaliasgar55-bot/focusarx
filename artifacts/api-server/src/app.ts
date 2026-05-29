import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getConfigErrors } from "./lib/config";
import { generalLimiter } from "./lib/rateLimiter";

const isDev = process.env.NODE_ENV !== "production";

const ALLOWED_ORIGINS = [
  process.env.APP_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined,
].filter(Boolean) as string[];

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
        connectSrc: ["'self'", "https:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isDev ? null : [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
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
      if (ALLOWED_ORIGINS.some((o) => origin === o || origin.endsWith(".replit.dev"))) {
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

app.use("/api", generalLimiter);

app.use("/api", (req, res, next) => {
  if (req.path === "/healthz") {
    next();
    return;
  }
  const missing = getConfigErrors();
  if (missing.length > 0) {
    res.status(503).json({
      error: "Server is missing required configuration",
      missing,
      hint: "Add these in your environment variables.",
    });
    return;
  }
  next();
});

app.use("/api", router);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.message?.startsWith("CORS")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: "Internal error" });
});

export default app;
