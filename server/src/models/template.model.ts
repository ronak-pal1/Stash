import mongoose, { Schema } from "mongoose";

const templateSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, maxlength: 80 },
    description: { type: String, default: "" },
    emoji: { type: String, default: "📝" },
    category: { type: String, default: "general" },
    content: { type: Schema.Types.Mixed, required: true },
    isBuiltIn: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Template = mongoose.model("Template", templateSchema);
