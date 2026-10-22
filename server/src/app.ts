import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { v1 } from "./routes/v1.js";

export const app = express();

app.set("trust proxy", 1);
app.use((req, res, next) => {
  req.requestId = req.header("x-request-id") || randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
});
app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== "test" }));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Stash API is running",
    data: {
      status: "ok",
      uptime: process.uptime(),
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    },
  });
});

app.use("/api/v1", v1);
app.use(notFoundHandler);
app.use(errorHandler);
