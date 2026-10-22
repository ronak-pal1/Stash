import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const attachmentSchema = new Schema(
  {
    key: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const noteSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      default: "",
      maxlength: 100_000,
    },
    tags: {
      type: [String],
      default: [],
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
  },
  { timestamps: true },
);

noteSchema.index({ owner: 1, isArchived: 1, isPinned: -1, updatedAt: -1 });
noteSchema.index({ owner: 1, tags: 1 });

export type IAttachment = InferSchemaType<typeof attachmentSchema> & { _id: Types.ObjectId };
export type INote = InferSchemaType<typeof noteSchema> & {
  _id: Types.ObjectId;
  attachments: IAttachment[];
};

export const Note = mongoose.model("Note", noteSchema);
