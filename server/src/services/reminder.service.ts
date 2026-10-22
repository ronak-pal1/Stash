import { badRequest, notFound } from "../libs/apiError.js";
import { Notification } from "../models/notification.model.js";
import { Reminder } from "../models/reminder.model.js";
import { Note } from "../models/note.model.js";
import { requireNote, requireWorkspace } from "./access.service.js";
import { asObjectId } from "../utils/objectId.js";
import { sendPush } from "./push.service.js";

const present = (reminder: {
  _id: { toString(): string };
  noteId: { toString(): string };
  workspaceId: { toString(): string };
  startDate: string;
  endDate: string;
  times: string[];
  repeat: string;
  status: string;
  snoozeUntil?: Date | null;
}) => ({
  id: reminder._id.toString(),
  noteId: reminder.noteId.toString(),
  workspaceId: reminder.workspaceId.toString(),
  startDate: reminder.startDate,
  endDate: reminder.endDate,
  times: reminder.times,
  repeat: reminder.repeat,
  status: reminder.status,
  snoozeUntil: reminder.snoozeUntil ?? null,
});

export const listReminders = async (userId: string, workspaceId: string, from?: string, to?: string) => {
  await requireWorkspace(userId, workspaceId);
  const filter: Record<string, unknown> = { workspaceId: asObjectId(workspaceId, "workspace"), userId: asObjectId(userId, "user") };
  if (from) filter.endDate = { ...(filter.endDate as object), $gte: from };
  if (to) filter.startDate = { ...(filter.startDate as object), $lte: to };
  const rows = await Reminder.find(filter).sort({ startDate: 1 });
  return rows.map(present);
};

export const createReminder = async (
  userId: string,
  input: { noteId: string; startDate: string; endDate: string; times: string[]; repeat: "none" | "daily" | "weekly" | "monthly" },
) => {
  const { note } = await requireNote(userId, input.noteId, "edit");
  if (input.endDate < input.startDate) throw badRequest("The end date is before the start date");
  const reminder = await Reminder.create({
    noteId: note._id,
    workspaceId: note.workspaceId,
    userId,
    startDate: input.startDate,
    endDate: input.endDate,
    times: input.times,
    repeat: input.repeat,
    status: "pending",
  });
  return present(reminder);
};

export const updateReminder = async (
  userId: string,
  reminderId: string,
  input: Partial<{ startDate: string; endDate: string; times: string[]; repeat: "none" | "daily" | "weekly" | "monthly"; status: "pending" | "done" | "snoozed" }>,
) => {
  const reminder = await Reminder.findOne({ _id: reminderId, userId });
  if (!reminder) throw notFound("Reminder not found");
  if (input.startDate) reminder.startDate = input.startDate;
  if (input.endDate) reminder.endDate = input.endDate;
  if (input.times) reminder.times = input.times;
  if (input.repeat) reminder.repeat = input.repeat;
  if (input.status) reminder.status = input.status;
  await reminder.save();
  return present(reminder);
};

export const snoozeReminder = async (userId: string, reminderId: string, minutes: number) => {
  const reminder = await Reminder.findOne({ _id: reminderId, userId });
  if (!reminder) throw notFound("Reminder not found");
  reminder.status = "snoozed";
  reminder.snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);
  await reminder.save();
  return present(reminder);
};

export const deleteReminder = async (userId: string, reminderId: string) => {
  const result = await Reminder.deleteOne({ _id: reminderId, userId });
  if (result.deletedCount === 0) throw notFound("Reminder not found");
};

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

const occursOn = (start: string, end: string, repeat: string, day: string) => {
  if (repeat === "none") return day >= start && day <= end;
  if (day < start) return false;
  if (repeat === "daily") return true;
  if (repeat === "weekly") return new Date(day).getUTCDay() === new Date(start).getUTCDay();
  if (repeat === "monthly") return new Date(day).getUTCDate() === new Date(start).getUTCDate();
  return false;
};

export const fireDueReminders = async (now = new Date()) => {
  const day = dateKey(now);
  const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const due = await Reminder.find({ status: { $in: ["pending", "snoozed"] } }).limit(200);
  let fired = 0;
  for (const reminder of due) {
    if (reminder.status === "snoozed" && reminder.snoozeUntil && reminder.snoozeUntil > now) continue;
    if (!occursOn(reminder.startDate, reminder.endDate, reminder.repeat, day)) continue;
    if (!reminder.times.includes(hhmm)) continue;
    if (reminder.lastFiredAt && dateKey(reminder.lastFiredAt) === day) continue;
    const note = await Note.findById(reminder.noteId);
    const title = note?.title || "Reminder";
    await Notification.create({
      userId: reminder.userId,
      title: "Reminder",
      body: title,
      noteId: reminder.noteId,
      reminderId: reminder._id,
      kind: "reminder",
    });
    await sendPush(reminder.userId.toString(), { title: "Reminder", body: title, noteId: reminder.noteId.toString() });
    reminder.lastFiredAt = now;
    if (reminder.repeat === "none") reminder.status = "done";
    else reminder.status = "pending";
    reminder.snoozeUntil = null;
    await reminder.save();
    fired += 1;
  }
  return fired;
};

export const listNotifications = async (userId: string) => {
  const rows = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50);
  return rows.map((row) => ({
    id: row._id.toString(),
    title: row.title,
    body: row.body,
    noteId: row.noteId ? row.noteId.toString() : null,
    kind: row.kind,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }));
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  await Notification.updateOne({ _id: notificationId, userId }, { readAt: new Date() });
};
