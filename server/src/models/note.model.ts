import mongoose, { Schema, type InferSchemaType } from "mongoose";

const noteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "", maxlength: 200 },
    emoji: { type: String, default: "" },
    content: { type: Schema.Types.Mixed, required: true },
    plainText: { type: String, default: "" },
    tags: { type: [String], default: [] },
    isPinned: { type: Boolean, default: false },
    isFavorite: { type: Boolean, default: false },
    colorLabel: { type: String, default: null },
    cover: {
      type: {
        kind: { type: String, enum: ["none", "upload", "gallery"], default: "none" },
        url: { type: String, default: null },
        position: { type: Number, default: 50 },
      },
      default: () => ({ kind: "none", url: null, position: 50 }),
    },
    locationLabel: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    lockHash: { type: String, default: null, select: false },
    isLocked: { type: Boolean, default: false },
    wordCount: { type: Number, default: 0 },
    readingMinutes: { type: Number, default: 0 },
    hasChecklist: { type: Boolean, default: false },
    hasImage: { type: Boolean, default: false },
    hasAudio: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

noteSchema.index({ title: "text", plainText: "text", tags: "text" });
noteSchema.index({ workspaceId: 1, folderId: 1, updatedAt: -1 });
noteSchema.index({ ownerId: 1, deletedAt: 1 });
noteSchema.index({ workspaceId: 1, deletedAt: 1, updatedAt: -1 });

export type NoteDoc = InferSchemaType<typeof noteSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const Note = mongoose.model("Note", noteSchema);
