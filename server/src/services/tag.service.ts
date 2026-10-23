import { notFound } from "../libs/apiError.js";
import { Note } from "../models/note.model.js";
import { Tag } from "../models/tag.model.js";
import { requireWorkspace } from "./access.service.js";
import { asObjectId } from "../utils/objectId.js";

export const listTags = async (userId: string, workspaceId: string) => {
  await requireWorkspace(userId, workspaceId);
  const tags = await Tag.find({ workspaceId }).sort({ name: 1 });
  const counts = await Note.aggregate<{ _id: string; count: number }>([
    { $match: { workspaceId: asObjectId(workspaceId, "workspace"), deletedAt: null } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((row) => [row._id, row.count]));
  return tags.map((tag) => ({
    id: tag._id.toString(),
    name: tag.name,
    color: tag.color,
    count: countMap.get(tag.name) ?? 0,
  }));
};

export const renameTag = async (userId: string, workspaceId: string, tagId: string, name: string) => {
  await requireWorkspace(userId, workspaceId);
  const tag = await Tag.findOne({ _id: tagId, workspaceId });
  if (!tag) throw notFound("Tag not found");
  const next = name.toLowerCase().trim();
  await Note.updateMany({ workspaceId, tags: tag.name }, { $set: { "tags.$[current]": next } }, { arrayFilters: [{ current: tag.name }] });
  const clash = await Tag.findOne({ workspaceId, name: next, _id: { $ne: tag._id } });
  if (clash) {
    await Tag.deleteOne({ _id: tag._id });
    return { id: clash._id.toString(), name: clash.name, merged: true };
  }
  tag.name = next;
  await tag.save();
  return { id: tag._id.toString(), name: tag.name, merged: false };
};

export const deleteTag = async (userId: string, workspaceId: string, tagId: string) => {
  await requireWorkspace(userId, workspaceId);
  const tag = await Tag.findOne({ _id: tagId, workspaceId });
  if (!tag) throw notFound("Tag not found");
  await Note.updateMany({ workspaceId }, { $pull: { tags: tag.name } });
  await Tag.deleteOne({ _id: tag._id });
};
