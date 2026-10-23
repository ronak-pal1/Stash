import mongoose, { Schema } from "mongoose";

const attachmentSchema = new Schema(
  {
    noteId: { type: Schema.Types.ObjectId, ref: "Note", default: null, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["image", "audio", "file", "avatar"], required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
  },
  { timestamps: true },
);

export const Attachment = mongoose.model("Attachment", attachmentSchema);
