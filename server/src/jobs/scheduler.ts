import cron from "node-cron";
import { logger } from "../config/logger.js";
import { purgeExpiredTrash } from "../services/note.service.js";
import { fireDueReminders } from "../services/reminder.service.js";

export const startJobs = () => {
  cron.schedule("* * * * *", () => {
    void fireDueReminders().catch((error: unknown) => logger.error({ err: error }, "reminder job failed"));
  });
  cron.schedule("15 * * * *", () => {
    void purgeExpiredTrash().catch((error: unknown) => logger.error({ err: error }, "trash purge failed"));
  });
};
