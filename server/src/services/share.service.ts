import { badRequest, notFound } from "../libs/apiError.js";
import { Note } from "../models/note.model.js";
import { Share } from "../models/share.model.js";
import { User } from "../models/user.model.js";
import { env } from "../config/env.js";
import { sha256, randomToken } from "../utils/tokens.js";
import { presentNote } from "./note.service.js";
import { requireNote } from "./access.service.js";
import { recordActivity } from "./activity.service.js";
import { sendMail } from "./mail.service.js";

const presentShare = (share: {
  _id: { toString(): string };
  type: string;
  role: string;
  email?: string | null;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  tokenHint?: string | null;
}) => ({
  id: share._id.toString(),
  type: share.type,
  role: share.role,
  email: share.email ?? null,
  expiresAt: share.expiresAt ?? null,
  revokedAt: share.revokedAt ?? null,
  tokenHint: share.tokenHint ?? null,
});

export const listShares = async (userId: string, noteId: string) => {
  await requireNote(userId, noteId);
  const shares = await Share.find({ noteId, revokedAt: null });
  return shares.map(presentShare);
};

export const shareWithEmail = async (userId: string, userName: string, noteId: string, email: string, role: "viewer" | "editor") => {
  const { note } = await requireNote(userId, noteId, "edit");
  const person = await User.findOne({ email: email.toLowerCase() });
  const share = await Share.findOneAndUpdate(
    { noteId: note._id, type: "user", email: email.toLowerCase() },
    {
      noteId: note._id,
      workspaceId: note.workspaceId,
      type: "user",
      userId: person?._id ?? null,
      email: email.toLowerCase(),
      role,
      revokedAt: null,
      createdBy: userId,
    },
    { upsert: true, returnDocument: "after" },
  );
  await sendMail(email, `${userName} shared a note on Stash`, `Open Stash to read "${note.title || "Untitled"}". Role: ${role}.`);
  await recordActivity({
    workspaceId: note.workspaceId.toString(),
    actorId: userId,
    actorName: userName,
    action: "note.shared",
    noteId: note._id.toString(),
    noteTitle: note.title,
    meta: { email, role },
  });
  return presentShare(share);
};

export const createPublicLink = async (userId: string, noteId: string, expiresAt?: string | null) => {
  const { note } = await requireNote(userId, noteId, "edit");
  const token = randomToken();
  const share = await Share.create({
    noteId: note._id,
    workspaceId: note.workspaceId,
    type: "link",
    role: "viewer",
    tokenHash: sha256(token),
    tokenHint: token.slice(0, 6),
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    createdBy: userId,
  });
  return { ...presentShare(share), url: `${env.CLIENT_URL}/p/${token}` };
};

export const revokeShare = async (userId: string, noteId: string, shareId: string) => {
  await requireNote(userId, noteId, "edit");
  const share = await Share.findOne({ _id: shareId, noteId });
  if (!share) throw notFound("Share not found");
  share.revokedAt = new Date();
  await share.save();
};

export const readPublicNote = async (token: string) => {
  const share = await Share.findOne({ type: "link", tokenHash: sha256(token), revokedAt: null });
  if (!share) throw notFound("This link is not available");
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) throw badRequest("This link has expired");
  const note = await Note.findById(share.noteId);
  if (!note || note.deletedAt || note.isLocked) throw notFound("This note is not available");
  const presented = presentNote(note);
  return { ...presented, public: true };
};
