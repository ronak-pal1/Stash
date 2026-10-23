import mongoose, { Schema } from "mongoose";

const noteVersionSchema = new Schema(
  {
    noteId: { type: Schema.Types.ObjectId, ref: "Note", required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "" },
    content: { type: Schema.Types.Mixed, required: true },
    plainText: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const NoteVersion = mongoose.model("NoteVersion", noteVersionSchema);
