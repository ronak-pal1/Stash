import { badRequest, notFound } from "../libs/apiError.js";
import { Folder } from "../models/folder.model.js";
import { Note } from "../models/note.model.js";
import { asObjectId } from "../utils/objectId.js";
import { requireWorkspace } from "./access.service.js";

const present = (folder: {
  _id: { toString(): string };
  name: string;
  icon: string;
  color: string;
  position: number;
  parentId?: { toString(): string } | null;
  workspaceId: { toString(): string };
}) => ({
  id: folder._id.toString(),
  workspaceId: folder.workspaceId.toString(),
  parentId: folder.parentId ? folder.parentId.toString() : null,
  name: folder.name,
  icon: folder.icon,
  color: folder.color,
  position: folder.position,
});

export const listFolders = async (userId: string, workspaceId: string) => {
  await requireWorkspace(userId, workspaceId);
  const folders = await Folder.find({ workspaceId: asObjectId(workspaceId, "workspace") }).sort({ position: 1 });
  const counts = await Note.aggregate<{ _id: string | null; count: number }>([
    { $match: { workspaceId: asObjectId(workspaceId, "workspace"), deletedAt: null } },
    { $group: { _id: "$folderId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((row) => [row._id ? String(row._id) : "all", row.count]));
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  return {
    folders: folders.map((folder) => ({ ...present(folder), count: countMap.get(folder._id.toString()) ?? 0 })),
    total,
  };
};

export const createFolder = async (
  userId: string,
  input: { workspaceId: string; name: string; icon?: string; color?: string; parentId?: string | null },
) => {
  await requireWorkspace(userId, input.workspaceId);
  if (input.parentId) {
    const parent = await Folder.findById(input.parentId);
    if (!parent || parent.workspaceId.toString() !== input.workspaceId) throw notFound("Parent folder not found");
    if (parent.parentId) throw badRequest("Folders can only be nested one level");
  }
  const last = await Folder.findOne({ workspaceId: input.workspaceId }).sort({ position: -1 });
  const folder = await Folder.create({
    workspaceId: input.workspaceId,
    parentId: input.parentId ?? null,
    name: input.name.trim(),
    icon: input.icon ?? "folder",
    color: input.color ?? "#6EC6F5",
    position: (last?.position ?? -1) + 1,
    createdBy: userId,
  });
  return { ...present(folder), count: 0 };
};

export const updateFolder = async (
  userId: string,
  folderId: string,
  input: { name?: string; icon?: string; color?: string },
) => {
  const folder = await Folder.findById(folderId);
  if (!folder) throw notFound("Folder not found");
  await requireWorkspace(userId, folder.workspaceId.toString());
  if (input.name) folder.name = input.name.trim();
  if (input.icon) folder.icon = input.icon;
  if (input.color) folder.color = input.color;
  await folder.save();
  return present(folder);
};

export const deleteFolder = async (userId: string, folderId: string) => {
  const folder = await Folder.findById(folderId);
  if (!folder) throw notFound("Folder not found");
  await requireWorkspace(userId, folder.workspaceId.toString());
  await Note.updateMany({ folderId: folder._id }, { folderId: null });
  await Note.updateMany({ folderId: { $in: await Folder.find({ parentId: folder._id }).distinct("_id") } }, { folderId: null });
  await Folder.deleteMany({ $or: [{ _id: folder._id }, { parentId: folder._id }] });
};

export const reorderFolders = async (userId: string, workspaceId: string, ids: string[]) => {
  await requireWorkspace(userId, workspaceId);
  await Promise.all(
    ids.map((id, index) =>
      Folder.updateOne({ _id: asObjectId(id, "folder"), workspaceId: asObjectId(workspaceId, "workspace") }, { position: index }),
    ),
  );
  return listFolders(userId, workspaceId);
};
