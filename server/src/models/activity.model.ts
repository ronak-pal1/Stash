import mongoose, { Schema } from "mongoose";

const activitySchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, required: true },
    noteId: { type: Schema.Types.ObjectId, ref: "Note", default: null },
    noteTitle: { type: String, default: "" },
    action: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ workspaceId: 1, createdAt: -1 });

export const Activity = mongoose.model("Activity", activitySchema);
