import mongoose, { Schema } from "mongoose";

const shareSchema = new Schema(
  {
    noteId: { type: Schema.Types.ObjectId, ref: "Note", required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    type: { type: String, enum: ["user", "link"], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    email: { type: String, default: null },
    role: { type: String, enum: ["viewer", "editor"], default: "viewer" },
    tokenHash: { type: String, default: null },
    tokenHint: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

shareSchema.index({ tokenHash: 1 });

export const Share = mongoose.model("Share", shareSchema);
