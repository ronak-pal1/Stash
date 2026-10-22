import mongoose, { Schema, type InferSchemaType } from "mongoose";

const memberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "admin", "member"], required: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false },
);

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    icon: { type: String, default: "notebook" },
    members: { type: [memberSchema], default: [] },
    inviteTokenHash: { type: String, default: null },
  },
  { timestamps: true },
);

export type WorkspaceDoc = InferSchemaType<typeof workspaceSchema> & { _id: mongoose.Types.ObjectId };
export const Workspace = mongoose.model("Workspace", workspaceSchema);

export const roleRank = { member: 1, admin: 2, owner: 3 } as const;
export type WorkspaceRole = keyof typeof roleRank;
