import mongoose from "mongoose";
import { MAX_ATTACHMENTS_PER_NOTE } from "../config/limits.js";
import { ApiError } from "../libs/apiError.js";
import { Note, type INote } from "../models/note.model.js";
import {
  buildAttachmentKey,
  deleteStoredObjects,
  getDownloadUrl,
  sanitizeFileName,
  uploadObject,
  DOWNLOAD_URL_TTL_SECONDS,
} from "./storage.service.js";

type NoteRecord = INote & { createdAt: Date; updatedAt: Date };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeTags = (tags: string[]) => {
  const unique = new Set<string>();

  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized) unique.add(normalized);
  }

  return [...unique];
};

export const toPublicNote = (note: NoteRecord) => ({
  id: note._id.toString(),
  ownerId: note.owner.toString(),
  title: note.title,
  content: note.content,
  tags: note.tags,
  isPinned: note.isPinned,
  isArchived: note.isArchived,
  attachments: note.attachments.map((attachment) => ({
    id: attachment._id.toString(),
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
  })),
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
});

const findOwnedNote = async (userId: string, noteId: string) => {
  if (!mongoose.isValidObjectId(noteId)) {
    throw new ApiError(400, "Invalid id");
  }

  const note = await Note.findOne({ _id: noteId, owner: userId });
  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  return note;
};

export const createNote = async (
  userId: string,
  input: { title: string; content?: string; tags?: string[]; isPinned?: boolean },
) => {
  const note = await Note.create({
    owner: userId,
    title: input.title,
    content: input.content ?? "",
    tags: normalizeTags(input.tags ?? []),
    isPinned: input.isPinned ?? false,
  });

  return toPublicNote(note);
};

export const listNotes = async (
  userId: string,
  query: { q?: string; tag?: string; archived?: "true" | "false"; page?: number; limit?: number },
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = {
    owner: userId,
    isArchived: query.archived === "true",
    ...(query.tag ? { tags: query.tag.trim().toLowerCase() } : {}),
    ...(query.q
      ? {
          $or: [
            { title: new RegExp(escapeRegex(query.q), "i") },
            { content: new RegExp(escapeRegex(query.q), "i") },
          ],
        }
      : {}),
  };

  const [notes, total] = await Promise.all([
    Note.find(filter)
      .sort({ isPinned: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Note.countDocuments(filter),
  ]);

  return {
    notes: notes.map((note) => toPublicNote(note)),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
};

export const getNote = async (userId: string, noteId: string) => {
  const note = await findOwnedNote(userId, noteId);
  return toPublicNote(note);
};

export const updateNote = async (
  userId: string,
  noteId: string,
  input: {
    title?: string;
    content?: string;
    tags?: string[];
    isPinned?: boolean;
    isArchived?: boolean;
  },
) => {
  const note = await findOwnedNote(userId, noteId);

  if (input.title !== undefined) note.title = input.title;
  if (input.content !== undefined) note.content = input.content;
  if (input.tags !== undefined) note.tags = normalizeTags(input.tags);
  if (input.isPinned !== undefined) note.isPinned = input.isPinned;
  if (input.isArchived !== undefined) note.isArchived = input.isArchived;

  await note.save();
  return toPublicNote(note);
};

export const deleteNote = async (userId: string, noteId: string) => {
  const note = await findOwnedNote(userId, noteId);
  await deleteStoredObjects(note.attachments.map((attachment) => attachment.key));
  await note.deleteOne();
  return { id: noteId };
};

export const addAttachment = async (
  userId: string,
  noteId: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
) => {
  const note = await findOwnedNote(userId, noteId);

  if (note.attachments.length >= MAX_ATTACHMENTS_PER_NOTE) {
    throw new ApiError(400, `A note can have at most ${MAX_ATTACHMENTS_PER_NOTE} attachments`);
  }

  const key = buildAttachmentKey(userId, noteId, file.originalname);

  try {
    await uploadObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    note.attachments.push({
      key,
      fileName: sanitizeFileName(file.originalname),
      mimeType: file.mimetype,
      size: file.size,
    });

    await note.save();
  } catch (error) {
    await deleteStoredObjects([key]).catch(() => undefined);
    throw error;
  }

  return toPublicNote(note);
};

export const deleteAttachment = async (userId: string, noteId: string, attachmentId: string) => {
  const note = await findOwnedNote(userId, noteId);
  const attachment = note.attachments.find((item) => item._id.toString() === attachmentId);

  if (!attachment) {
    throw new ApiError(404, "Attachment not found");
  }

  await deleteStoredObjects([attachment.key]);
  note.attachments.pull({ _id: attachment._id });
  await note.save();

  return toPublicNote(note);
};

export const getAttachmentDownloadUrl = async (userId: string, noteId: string, attachmentId: string) => {
  const note = await findOwnedNote(userId, noteId);
  const attachment = note.attachments.find((item) => item._id.toString() === attachmentId);

  if (!attachment) {
    throw new ApiError(404, "Attachment not found");
  }

  const url = await getDownloadUrl(attachment.key);

  return {
    url,
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    fileName: attachment.fileName,
  };
};
