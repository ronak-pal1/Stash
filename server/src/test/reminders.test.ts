import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { Reminder } from "../models/reminder.model.js";
import { fireDueReminders } from "../services/reminder.service.js";
import { auth, register } from "./helpers.js";

describe("reminders", () => {
  it("creates a reminder and fires it when the time matches", async () => {
    const account = await register("remind@example.com", "Reminder");
    const workspaceId = (await request(app).get("/api/v1/workspaces").set(auth(account.token))).body.data[0].id as string;
    const note = await request(app).post("/api/v1/notes").set(auth(account.token)).send({ workspaceId, title: "Call Priya" });
    const now = new Date("2026-10-22T10:30:00.000Z");
    const created = await request(app).post("/api/v1/reminders").set(auth(account.token)).send({
      noteId: note.body.data.id,
      startDate: "2026-10-22",
      endDate: "2026-10-22",
      times: ["10:30"],
      repeat: "none",
    });
    expect(created.status).toBe(201);
    await Reminder.updateOne({ _id: created.body.data.id }, { times: ["10:30"] });
    const fired = await fireDueReminders(now);
    expect(fired).toBe(1);
    const inbox = await request(app).get("/api/v1/notifications").set(auth(account.token));
    expect(inbox.body.data[0].body).toBe("Call Priya");
  });
});
