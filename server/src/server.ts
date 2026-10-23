import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDb } from "./config/db.js";
import { startJobs } from "./jobs/scheduler.js";
import { ensureBuiltInTemplates } from "./services/template.service.js";
import { attachSockets } from "./sockets/index.js";

export const start = async () => {
  await connectDb();
  await ensureBuiltInTemplates();
  const httpServer = createServer(app);
  attachSockets(httpServer);
  if (env.NODE_ENV !== "test") startJobs();
  await new Promise<void>((resolve) => {
    httpServer.listen(env.PORT, () => {
      logger.info(`Stash API listening on http://localhost:${env.PORT}`);
      resolve();
    });
  });
  return httpServer;
};
