import { forbidden, notFound } from "../libs/apiError.js";
import { Note } from "../models/note.model.js";
import { Share } from "../models/share.model.js";
import { Workspace, type WorkspaceRole, roleRank } from "../models/workspace.model.js";
import { asObjectId } from "../utils/objectId.js";

export const requireWorkspace = async (userId: string, workspaceId: string, minimum: WorkspaceRole = "member") => {
  const workspace = await Workspace.findById(asObjectId(workspaceId, "workspace"));
  if (!workspace) throw notFound("Workspace not found");
  const member = workspace.members.find((item) => item.userId.toString() === userId);
  if (!member || roleRank[member.role as WorkspaceRole] < roleRank[minimum]) throw forbidden();
  return { workspace, role: member.role as WorkspaceRole };
};

export const requireNote = async (userId: string, noteId: string, mode: "read" | "edit" = "read") => {
  const note = await Note.findById(asObjectId(noteId, "note")).select("+lockHash");
  if (!note || !note.workspaceId) throw notFound("Note not found");
  const workspace = await Workspace.findById(note.workspaceId);
  if (!workspace) throw notFound("Note not found");
  const member = workspace.members.find((item) => item.userId.toString() === userId);
  const foundShare = await Share.findOne({
    noteId: note._id,
    type: "user",
    userId: asObjectId(userId, "user"),
    revokedAt: null,
  });
  const share = foundShare && (!foundShare.expiresAt || foundShare.expiresAt.getTime() > Date.now()) ? foundShare : null;
  if (!member && !share) throw notFound("Note not found");
  const canEdit = Boolean(member) || share?.role === "editor" || note.ownerId.toString() === userId;
  if (mode === "edit" && !canEdit) throw forbidden("You have view-only access to this note");
  if (mode === "edit" && note.deletedAt) throw forbidden("Restore this note before editing it");
  const role: WorkspaceRole = (member?.role as WorkspaceRole | undefined) ?? "member";
  return { note, workspace, role, canEdit };
};
