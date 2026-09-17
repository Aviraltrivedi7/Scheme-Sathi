import "dotenv/config";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { STANDALONE_MODE, ENV, TRUST_PROXY } from "./env";
import { registerLocalAuthRoutes } from "./localAuth";
import {
  attachLocalScheduler,
  ensureSchemeSyncBot,
  rearmDailyExpiryScan,
} from "./localScheduler";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { applicationReminderHandler, documentExpiryReminderHandler, documentReviewDueReminderHandler, schemeSyncHandler } from "../scheduled";
import { registerSchemeHelpRoutes } from "../schemeHelpRoutes";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Behind a trusted reverse proxy, derive req.ip/req.protocol from the
  // X-Forwarded-* headers the proxy sets — otherwise every visitor shares
  // the proxy's IP and per-IP rate limits lock everyone out together.
  // Opt-in: with an untrusted proxy those headers are client-spoofable.
  if (TRUST_PROXY) {
    app.set("trust proxy", true);
    console.log("[Server] TRUST_PROXY enabled — using X-Forwarded-* headers for client IP and protocol");
  }
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Conservative security headers; the SPA needs none of the risky defaults.
  // CSP: Vite dev injects inline scripts/HMR, so dev needs 'unsafe-inline';
  // production assets are hashed files, but the index.html still carries a
  // small inline bootstrap and the PWA registers 'self' scripts — keep it
  // permissive-but-sane rather than break the app silently.
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
  app.use((_req, res, next) => {
    res.set({
      "Content-Security-Policy": cspDirectives,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "same-origin",
    });
    // HSTS: tell browsers to stay on HTTPS for a year. Only meaningful once
    // the deployment actually serves TLS — opt in via HSTS=1 (e.g. behind a
    // proxy that terminates TLS). Sending it on plain HTTP is ignored by
    // browsers but pollutes responses, so gate it.
    if (process.env.HSTS === "1") {
      res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
  // Session-bearing API responses must never stick in a browser or
  // intermediary cache — auth.me leaking from disk cache is a real class
  // of bug on shared machines (cyber cafés, college labs).
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // Gzip/deflate every sizable text response (JS/CSS/JSON/tRPC payloads).
  // The 1.4MB app bundle ships as ~370KB over the wire — the single biggest
  // page-load win available on HTTP deployments without a reverse proxy.
  app.use(compression({ threshold: 1024 }));

  registerStorageProxy(app);
  if (STANDALONE_MODE) {
    registerLocalAuthRoutes(app);
  } else {
    registerOAuthRoutes(app);
  }
  // Runtime auth-mode probe for the client: one build works on both the
  // platform (OAuth) and standalone (credentials) deployments without
  // rebuild-time flags.
  app.get("/api/auth/mode", (_req, res) => {
    res.json({ mode: STANDALONE_MODE ? "credentials" : "oauth" });
  });
  // Liveness/readiness probe for orchestrators and the docker HEALTHCHECK.
  app.get("/api/health", async (_req, res) => {
    let database = "unavailable";
    try {
      const db = await getDb();
      if (db) {
        await db.execute("SELECT 1");
        database = "up";
      }
    } catch {
      database = "down";
    }
    res
      .status(database === "down" ? 503 : 200)
      .json({
        status: database === "down" ? "unhealthy" : "healthy",
        mode: STANDALONE_MODE ? "standalone" : "platform",
        auth: STANDALONE_MODE ? "credentials" : "oauth",
        database,
        uptimeSeconds: Math.floor(process.uptime()),
        checkedAt: new Date().toISOString(),
      });
  });
  app.post("/api/scheduled/application-reminder", applicationReminderHandler);
  app.post("/api/scheduled/document-expiry-reminders", documentExpiryReminderHandler);
  app.post("/api/scheduled/document-review-due-reminder", documentReviewDueReminderHandler);
  app.post("/api/scheduled/scheme-sync", schemeSyncHandler);
  registerSchemeHelpRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Unmatched API routes must return JSON 404 — registered BEFORE the SPA
  // fallback in serveStatic, which would otherwise hand API clients the
  // index.html shell with a 200.
  app.use("/api", (_req: express.Request, res: express.Response) => {
    res.status(404).json({ error: { message: "Not found" } });
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ---- Error handling (must be registered AFTER all routes) ----
  // Without this, Express's default handler returns an HTML stack trace
  // whenever NODE_ENV isn't "production" — leaking server paths to clients.
  // APIs get a JSON body; pages get a quiet 500.
  app.use(
    (err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error("[Server] Unhandled route error:", err);
      // Express convention: if the response already started, only the
      // default handler can safely abort the connection.
      if (res.headersSent) {
        next(err);
        return;
      }
      if (req.path.startsWith("/api")) {
        res.status(500).json({ error: { message: "Internal server error" } });
      } else {
        res.status(500).type("html").send(
          "<!doctype html><meta charset=\"utf-8\"><title>Error</title>" +
          "<body style=\"font-family:system-ui;padding:2rem\">Something went wrong. Please try again.</body>"
        );
      }
    }
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    if (STANDALONE_MODE) {
      console.log("[Standalone] Platform OAuth/Forge disabled — using local credentials, disk storage, and in-process scheduler.");
      if (process.env.NODE_ENV === "production" && !ENV.cookieSecret) {
        console.warn(
          "[Standalone] WARNING: JWT_SECRET is not set — using the deterministic dev fallback. Set a long random JWT_SECRET before real production use."
        );
      }
      attachLocalScheduler(app, port);
      rearmDailyExpiryScan().catch(error =>
        console.warn("[Standalone] Boot scan re-arm failed:", String(error))
      );
      ensureSchemeSyncBot().catch(error =>
        console.warn("[Standalone] Scheme sync bot failed to arm:", String(error))
      );
    }
  });

  // Graceful shutdown: stop accepting new work, let in-flight requests and
  // the local scheduler finish, then exit. Docker/PM2 send SIGTERM; Ctrl+C
  // in dev sends SIGINT.
  const shutdown = (signal: string) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully`);
    server.close(() => {
      console.log("[Server] HTTP server closed");
      process.exit(0);
    });
    // Safety net: force-exit if something keeps the event loop alive.
    setTimeout(() => {
      console.warn("[Server] Forced exit after 10s wait");
      process.exit(0);
    }, 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Unhandled rejections/errors must never kill the process silently mid-
  // request; log loudly and keep serving.
  process.on("unhandledRejection", reason => {
    console.error("[Server] Unhandled rejection:", reason);
  });
  process.on("uncaughtException", error => {
    console.error("[Server] Uncaught exception:", error);
  });
}

startServer().catch(console.error);
