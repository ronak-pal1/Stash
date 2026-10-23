import mongoose, { Schema } from "mongoose";

const commentSchema = new Schema(
  {
    noteId: { type: Schema.Types.ObjectId, ref: "Note", required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    body: { type: String, required: true, maxlength: 4000 },
    quote: { type: String, default: "" },
    resolved: { type: Boolean, default: false },
    mentions: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const Comment = mongoose.model("Comment", commentSchema);
