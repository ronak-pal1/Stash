import { notFound } from "../libs/apiError.js";
import { BUILT_IN_TEMPLATES } from "../data/defaults.js";
import { Template } from "../models/template.model.js";
import type { JSONContent } from "../utils/content.js";
import { requireWorkspace } from "./access.service.js";
import { createNote } from "./note.service.js";

export const ensureBuiltInTemplates = async () => {
  for (const template of BUILT_IN_TEMPLATES) {
    await Template.updateOne(
      { isBuiltIn: true, name: template.name },
      { $set: { ...template, isBuiltIn: true, workspaceId: null, ownerId: null } },
      { upsert: true },
    );
  }
};

const present = (template: {
  _id: { toString(): string };
  name: string;
  description: string;
  emoji: string;
  category: string;
  isBuiltIn: boolean;
  content: unknown;
}) => ({
  id: template._id.toString(),
  name: template.name,
  description: template.description,
  emoji: template.emoji,
  category: template.category,
  isBuiltIn: template.isBuiltIn,
  content: template.content as JSONContent,
});

export const listTemplates = async (userId: string, workspaceId: string) => {
  await requireWorkspace(userId, workspaceId);
  await ensureBuiltInTemplates();
  const rows = await Template.find({ $or: [{ isBuiltIn: true }, { workspaceId }] }).sort({ isBuiltIn: -1, name: 1 });
  return rows.map(present);
};

export const createTemplateFromNote = async (userId: string, workspaceId: string, name: string, content: JSONContent, emoji?: string) => {
  await requireWorkspace(userId, workspaceId);
  const template = await Template.create({
    workspaceId,
    ownerId: userId,
    name,
    description: "Saved from a note",
    emoji: emoji || "📝",
    category: "custom",
    content,
    isBuiltIn: false,
  });
  return present(template);
};

export const useTemplate = async (userId: string, userName: string, templateId: string, workspaceId: string, folderId?: string | null) => {
  await requireWorkspace(userId, workspaceId);
  const template = await Template.findById(templateId);
  if (!template) throw notFound("Template not found");
  if (!template.isBuiltIn && template.workspaceId?.toString() !== workspaceId) throw notFound("Template not found");
  return createNote(userId, userName, {
    workspaceId,
    folderId,
    title: template.name,
    emoji: template.emoji,
    content: template.content as JSONContent,
  });
};
