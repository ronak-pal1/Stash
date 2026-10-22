import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    noteId: { type: Schema.Types.ObjectId, ref: "Note", default: null },
    reminderId: { type: Schema.Types.ObjectId, ref: "Reminder", default: null },
    kind: { type: String, default: "info" },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Notification = mongoose.model("Notification", notificationSchema);
