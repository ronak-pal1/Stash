import { disconnectDb } from "./config/db.js";
import { logger } from "./config/logger.js";
import { start } from "./server.js";

const httpServer = await start();

const shutdown = (signal: string) => {
  logger.info(`${signal} received, closing server`);
  httpServer.close(() => {
    void disconnectDb().finally(() => process.exit(0));
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
