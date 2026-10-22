import mongoose, { Schema, type InferSchemaType } from "mongoose";

const folderSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    icon: { type: String, default: "folder" },
    color: { type: String, default: "#6EC6F5" },
    position: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

folderSchema.index({ workspaceId: 1, position: 1 });

export type FolderDoc = InferSchemaType<typeof folderSchema> & { _id: mongoose.Types.ObjectId };
export const Folder = mongoose.model("Folder", folderSchema);
