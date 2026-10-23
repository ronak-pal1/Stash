import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { env } from "../config/env.js";
import { ApiError, badRequest, unauthorized } from "../libs/apiError.js";
import { Folder } from "../models/folder.model.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import { User, publicUser, type UserDocument } from "../models/user.model.js";
import { Workspace } from "../models/workspace.model.js";
import { DEFAULT_FOLDERS } from "../data/defaults.js";
import { sendMail } from "./mail.service.js";
import { saveBuffer } from "./storage.service.js";
import { Attachment } from "../models/attachment.model.js";
import {
  randomToken,
  refreshCookieName,
  refreshMaxAgeMs,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens.js";

const planLimit = { free: 1, pro: 5, team: 50 } as const;

export const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(refreshCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/api/v1/auth",
    maxAge: refreshMaxAgeMs(),
  });
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie(refreshCookieName, { path: "/api/v1/auth" });
};

const issueSession = async (userId: string, res: Response) => {
  const jti = randomUUID();
  const refresh = signRefreshToken(userId, jti);
  await RefreshToken.create({
    userId,
    jti,
    tokenHash: sha256(refresh),
    expiresAt: new Date(Date.now() + refreshMaxAgeMs()),
  });
  setRefreshCookie(res, refresh);
  return { accessToken: signAccessToken(userId) };
};

const createPersonalWorkspace = async (user: UserDocument) => {
  const owned = await Workspace.countDocuments({ ownerId: user._id });
  if (owned >= planLimit.free) return;
  const workspace = await Workspace.create({
    name: "Personal",
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
  return workspace;
};

export const registerUser = async (input: { name: string; email: string; password: string }, res: Response) => {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new ApiError(409, "An account with that email already exists");
  const user = await User.create({
    name: input.name.trim(),
    email: input.email.toLowerCase(),
    password: input.password,
  });
  await createPersonalWorkspace(user);
  const session = await issueSession(user._id.toString(), res);
  return { user: publicUser(user), ...session };
};

export const loginUser = async (input: { email: string; password: string }, res: Response) => {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(input.password))) {
    throw unauthorized("Email or password is incorrect");
  }
  const session = await issueSession(user._id.toString(), res);
  return { user: publicUser(user), ...session };
};

export const refreshSession = async (token: string | undefined, res: Response) => {
  if (!token) throw unauthorized();
  const claims = verifyRefreshToken(token);
  const stored = await RefreshToken.findOne({ jti: claims.jti, revokedAt: null });
  if (!stored || stored.tokenHash !== sha256(token) || stored.expiresAt.getTime() < Date.now()) {
    throw unauthorized("Session expired");
  }
  stored.revokedAt = new Date();
  await stored.save();
  const user = await User.findById(claims.sub);
  if (!user) throw unauthorized();
  const session = await issueSession(user._id.toString(), res);
  return { user: publicUser(user), ...session };
};

export const logoutUser = async (token: string | undefined, res: Response) => {
  if (token) {
    try {
      const claims = verifyRefreshToken(token);
      await RefreshToken.updateOne({ jti: claims.jti }, { revokedAt: new Date() });
    } catch {
      // An expired cookie should still clear.
    }
  }
  clearRefreshCookie(res);
};

export const requestPasswordReset = async (email: string) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+resetTokenHash +resetTokenExpires");
  if (!user) return;
  const token = randomToken();
  user.resetTokenHash = sha256(token);
  user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();
  const link = `${env.CLIENT_URL}/reset-password?token=${token}`;
  await sendMail(user.email, "Reset your Stash password", `Reset your password: ${link}\n\nThis link expires in one hour.`);
};

export const resetPassword = async (token: string, password: string) => {
  const user = await User.findOne({
    resetTokenHash: sha256(token),
    resetTokenExpires: { $gt: new Date() },
  }).select("+password +resetTokenHash +resetTokenExpires");
  if (!user) throw badRequest("This reset link is invalid or expired");
  user.password = password;
  user.resetTokenHash = null;
  user.resetTokenExpires = null;
  await user.save();
  await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
};

export const updateProfile = async (userId: string, input: { name?: string }) => {
  const user = await User.findById(userId);
  if (!user) throw unauthorized();
  if (input.name) user.name = input.name.trim();
  await user.save();
  await Workspace.updateMany(
    { "members.userId": user._id },
    { $set: { "members.$[member].name": user.name } },
    { arrayFilters: [{ "member.userId": user._id }] },
  );
  return publicUser(user);
};

export const changePassword = async (userId: string, current: string, next: string) => {
  const user = await User.findById(userId).select("+password");
  if (!user || !(await user.comparePassword(current))) throw badRequest("Current password is incorrect");
  user.password = next;
  await user.save();
  await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
};

export const saveAvatar = async (userId: string, file: Express.Multer.File) => {
  const user = await User.findById(userId);
  if (!user) throw unauthorized();
  const stored = await saveBuffer(file.buffer, `${userId}-avatar`, file.mimetype, "avatar");
  user.avatarPath = stored.storagePath;
  await user.save();
  await Attachment.findOneAndUpdate(
    { uploadedBy: user._id, kind: "avatar" },
    {
      uploadedBy: user._id,
      workspaceId: user._id,
      kind: "avatar",
      fileName: file.originalname,
      mimeType: stored.mimeType,
      size: stored.size,
      storagePath: stored.storagePath,
    },
    { upsert: true },
  );
  return publicUser(user);
};

export const deleteAccount = async (userId: string, password: string) => {
  const user = await User.findById(userId).select("+password");
  if (!user || !(await user.comparePassword(password))) throw badRequest("Password is incorrect");
  const owned = await Workspace.find({ ownerId: user._id });
  for (const workspace of owned) {
    const others = workspace.members.filter((member) => member.userId.toString() !== userId);
    if (others.length === 0) {
      await Workspace.deleteOne({ _id: workspace._id });
    } else {
      const nextOwner = others[0];
      if (!nextOwner) continue;
      workspace.ownerId = nextOwner.userId;
      nextOwner.role = "owner";
      workspace.members.pull({ userId: user._id });
      await workspace.save();
    }
  }
  await Workspace.updateMany({ "members.userId": user._id }, { $pull: { members: { userId: user._id } } });
  await RefreshToken.deleteMany({ userId: user._id });
  await User.deleteOne({ _id: user._id });
};

export const setPlan = async (userId: string, plan: "free" | "pro" | "team") => {
  const user = await User.findById(userId);
  if (!user) throw unauthorized();
  user.plan = plan;
  user.trialEndsAt = plan === "free" ? null : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await user.save();
  return publicUser(user);
};

export const getMe = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw unauthorized();
  return publicUser(user);
};
