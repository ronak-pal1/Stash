import mongoose, { Schema } from "mongoose";

const reminderSchema = new Schema(
  {
    noteId: { type: Schema.Types.ObjectId, ref: "Note", required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    times: { type: [String], default: ["09:00"] },
    repeat: { type: String, enum: ["none", "daily", "weekly", "monthly"], default: "none" },
    status: { type: String, enum: ["pending", "done", "snoozed"], default: "pending" },
    snoozeUntil: { type: Date, default: null },
    lastFiredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Reminder = mongoose.model("Reminder", reminderSchema);
