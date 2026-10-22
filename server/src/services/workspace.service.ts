import { randomToken, sha256 } from "../utils/tokens.js";
import { badRequest, forbidden, notFound } from "../libs/apiError.js";
import { Folder } from "../models/folder.model.js";
import { User } from "../models/user.model.js";
import { Workspace, type WorkspaceRole } from "../models/workspace.model.js";
import { DEFAULT_FOLDERS } from "../data/defaults.js";
import { requireWorkspace } from "./access.service.js";
import { sendMail } from "./mail.service.js";
import { env } from "../config/env.js";
import { asObjectId } from "../utils/objectId.js";

const limits = { free: { workspaces: 1, members: 3 }, pro: { workspaces: 5, members: 10 }, team: { workspaces: 50, members: 100 } };

const presentWorkspace = (workspace: {
  _id: { toString(): string };
  name: string;
  icon: string;
  ownerId: { toString(): string };
  members: Array<{ userId: { toString(): string }; role: string; email: string; name: string }>;
  createdAt?: Date;
}) => ({
  id: workspace._id.toString(),
  name: workspace.name,
  icon: workspace.icon,
  ownerId: workspace.ownerId.toString(),
  members: workspace.members.map((member) => ({
    userId: member.userId.toString(),
    role: member.role,
    email: member.email,
    name: member.name,
  })),
  createdAt: workspace.createdAt ?? null,
});

export const listWorkspaces = async (userId: string) => {
  const rows = await Workspace.find({ "members.userId": asObjectId(userId, "user") }).sort({ createdAt: 1 });
  return rows.map((row) => presentWorkspace(row));
};

export const createWorkspace = async (userId: string, name: string) => {
  const user = await User.findById(userId);
  if (!user) throw notFound("Account not found");
  const owned = await Workspace.countDocuments({ ownerId: user._id });
  if (owned >= limits[user.plan].workspaces) {
    throw forbidden(`The ${user.plan} plan allows ${limits[user.plan].workspaces} workspace${limits[user.plan].workspaces === 1 ? "" : "s"}`);
  }
  const workspace = await Workspace.create({
    name: name.trim(),
    ownerId: user._id,
    icon: "notebook",
    members: [{ userId: user._id, role: "owner", email: user.email, name: user.name }],
  });
  await Folder.insertMany(
    DEFAULT_FOLDERS.map((folder, index) => ({
      workspaceId: workspace._id,
      name: folder.name,
      icon: folder.icon,
      color: folder.color,
      position: index,
      createdBy: user._id,
    })),
  );
  return presentWorkspace(workspace);
};

export const updateWorkspace = async (userId: string, workspaceId: string, input: { name?: string; icon?: string }) => {
  const { workspace } = await requireWorkspace(userId, workspaceId, "admin");
  if (input.name) workspace.name = input.name.trim();
  if (input.icon) workspace.icon = input.icon;
  await workspace.save();
  return presentWorkspace(workspace);
};

export const inviteToWorkspace = async (userId: string, workspaceId: string, email: string, role: "admin" | "member") => {
  const { workspace } = await requireWorkspace(userId, workspaceId, "admin");
  const owner = await User.findById(workspace.ownerId);
  const cap = limits[owner?.plan ?? "free"].members;
  if (workspace.members.length >= cap) throw forbidden("This workspace is at its member limit");
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing && workspace.members.some((member) => member.userId.toString() === existing._id.toString())) {
    throw badRequest("That person is already in this workspace");
  }
  const token = randomToken();
  workspace.inviteTokenHash = sha256(`${email.toLowerCase()}:${token}`);
  await workspace.save();
  const link = `${env.CLIENT_URL}/join?token=${token}&email=${encodeURIComponent(email.toLowerCase())}&workspace=${workspace._id.toString()}`;
  await sendMail(email, `Join ${workspace.name} on Stash`, `${link}\n\nRole: ${role}`);
  if (existing) {
    workspace.members.push({ userId: existing._id, role, email: existing.email, name: existing.name });
    workspace.inviteTokenHash = null;
    await workspace.save();
  }
  return { invited: email.toLowerCase(), joined: Boolean(existing), link: env.NODE_ENV === "production" ? null : link };
};

export const joinWorkspace = async (userId: string, token: string, email: string, workspaceId: string) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace || workspace.inviteTokenHash !== sha256(`${email.toLowerCase()}:${token}`)) {
    throw badRequest("This invite is invalid");
  }
  const user = await User.findById(userId);
  if (!user || user.email !== email.toLowerCase()) throw forbidden("Sign in with the invited email");
  if (!workspace.members.some((member) => member.userId.toString() === userId)) {
    workspace.members.push({ userId: user._id, role: "member", email: user.email, name: user.name });
  }
  workspace.inviteTokenHash = null;
  await workspace.save();
  return presentWorkspace(workspace);
};

export const updateMember = async (userId: string, workspaceId: string, memberId: string, role: WorkspaceRole) => {
  const { workspace } = await requireWorkspace(userId, workspaceId, "admin");
  if (role === "owner") throw badRequest("Transfer ownership from the workspace settings");
  const member = workspace.members.find((item) => item.userId.toString() === memberId);
  if (!member) throw notFound("Member not found");
  if (member.role === "owner") throw forbidden();
  member.role = role;
  await workspace.save();
  return presentWorkspace(workspace);
};

export const removeMember = async (userId: string, workspaceId: string, memberId: string) => {
  const { workspace, role } = await requireWorkspace(userId, workspaceId);
  const removingSelf = userId === memberId;
  if (!removingSelf && role === "member") throw forbidden();
  const member = workspace.members.find((item) => item.userId.toString() === memberId);
  if (!member) throw notFound("Member not found");
  if (member.role === "owner") throw badRequest("The owner cannot leave without deleting the workspace");
  workspace.members.pull({ userId: member.userId });
  await workspace.save();
};
