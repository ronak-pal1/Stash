import mongoose, { Schema } from "mongoose";

const tagSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, lowercase: true, trim: true, maxlength: 40 },
    color: { type: String, default: "#6EC6F5" },
  },
  { timestamps: true },
);

tagSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export const Tag = mongoose.model("Tag", tagSchema);
