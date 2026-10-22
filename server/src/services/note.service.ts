import bcrypt from "bcryptjs";
import type { QueryFilter } from "mongoose";
import { env } from "../config/env.js";
import { ApiError, forbidden, notFound } from "../libs/apiError.js";
import { Comment } from "../models/comment.model.js";
import { Note, type NoteDoc } from "../models/note.model.js";
import { NoteVersion } from "../models/noteVersion.model.js";
import { Reminder } from "../models/reminder.model.js";
import { Share } from "../models/share.model.js";
import { Tag } from "../models/tag.model.js";
import { Attachment } from "../models/attachment.model.js";
import { emptyDoc, docFlags, extractHashtags, plainTextFromDoc, readingMinutes, wordCountOf, type JSONContent } from "../utils/content.js";
import { decodeCursor, encodeCursor, asObjectId } from "../utils/objectId.js";
import { signFileToken, signNoteUnlock, verifyNoteUnlock } from "../utils/tokens.js";
import { requireNote, requireWorkspace } from "./access.service.js";
import { recordActivity } from "./activity.service.js";
import { removeStored, saveBuffer } from "./storage.service.js";

export interface NoteListQuery {
  workspaceId: string;
  q?: string;
  tag?: string;
  folderId?: string;
  pinned?: boolean;
  favorite?: boolean;
  hasChecklist?: boolean;
  hasImage?: boolean;
  hasAudio?: boolean;
  from?: string;
  to?: string;
  trashed?: boolean;
  sort?: "updated" | "created" | "title";
  cursor?: string;
  limit?: number;
}

const previewOf = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 180);

export const presentNote = (
  note: NoteDoc,
  options: { includeContent: boolean; userId?: string; collaborators?: Array<{ id: string; name: string }> } = { includeContent: true },
) => ({
  id: note._id.toString(),
  workspaceId: note.workspaceId.toString(),
  folderId: note.folderId ? note.folderId.toString() : null,
  ownerId: note.ownerId.toString(),
  title: note.title,
  emoji: note.emoji,
  content: options.includeContent ? (note.content as JSONContent) : null,
  tags: note.tags,
  isPinned: note.isPinned,
  isFavorite: note.isFavorite,
  colorLabel: note.colorLabel,
  cover: note.cover,
  locationLabel: note.locationLabel,
  latitude: note.latitude,
  longitude: note.longitude,
  isLocked: note.isLocked,
  locked: note.isLocked && !options.includeContent,
  wordCount: note.wordCount,
  readingMinutes: note.readingMinutes,
  hasChecklist: note.hasChecklist,
  hasImage: note.hasImage,
  hasAudio: note.hasAudio,
  version: note.version,
  preview: previewOf(options.includeContent ? note.plainText : ""),
  deletedAt: note.deletedAt,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
  collaborators: options.collaborators ?? [],
});

const syncTags = async (workspaceId: string, tags: string[]) => {
  await Promise.all(
    tags.map((name) =>
      Tag.updateOne({ workspaceId, name }, { $setOnInsert: { workspaceId, name, color: "#6EC6F5" } }, { upsert: true }),
    ),
  );
};

const applyDerived = (note: { content: unknown; tags: string[]; plainText: string; wordCount: number; readingMinutes: number; hasChecklist: boolean; hasImage: boolean; hasAudio: boolean }, content: JSONContent, extraTags: string[] = []) => {
  const plain = plainTextFromDoc(content);
  const tags = [...new Set([...extractHashtags(`${plain} ${extraTags.map((tag) => `#${tag}`).join(" ")}`), ...extraTags.map((tag) => tag.toLowerCase())])];
  const flags = docFlags(content);
  note.content = content;
  note.plainText = plain;
  note.tags = tags;
  note.wordCount = wordCountOf(plain);
  note.readingMinutes = readingMinutes(plain);
  note.hasChecklist = flags.hasChecklist;
  note.hasImage = flags.hasImage;
  note.hasAudio = flags.hasAudio;
  return tags;
};

const collaboratorMap = async (noteIds: string[]) => {
  const shares = await Share.find({ noteId: { $in: noteIds }, type: "user", revokedAt: null }).limit(200);
  const map = new Map<string, Array<{ id: string; name: string }>>();
  for (const share of shares) {
    const key = share.noteId.toString();
    const list = map.get(key) ?? [];
    list.push({ id: share.userId?.toString() ?? share.email ?? "link", name: share.email ?? "Guest" });
    map.set(key, list);
  }
  return map;
};

export const listNotes = async (userId: string, query: NoteListQuery) => {
  await requireWorkspace(userId, query.workspaceId);
  const limit = Math.min(query.limit ?? 20, 50);
  const filter: QueryFilter<NoteDoc> = {
    workspaceId: asObjectId(query.workspaceId, "workspace"),
    deletedAt: query.trashed ? { $ne: null } : null,
  };
  if (query.folderId) filter.folderId = asObjectId(query.folderId, "folder");
  if (query.tag) filter.tags = query.tag.toLowerCase();
  if (query.pinned) filter.isPinned = true;
  if (query.favorite) filter.isFavorite = true;
  if (query.hasChecklist) filter.hasChecklist = true;
  if (query.hasImage) filter.hasImage = true;
  if (query.hasAudio) filter.hasAudio = true;
  if (query.from || query.to) {
    filter.updatedAt = {};
    if (query.from) (filter.updatedAt as { $gte?: Date }).$gte = new Date(query.from);
    if (query.to) (filter.updatedAt as { $lte?: Date }).$lte = new Date(query.to);
  }
  const sort: Record<string, 1 | -1 | { $meta: "textScore" }> =
    query.sort === "title" ? { title: 1, _id: 1 } : query.sort === "created" ? { createdAt: -1, _id: -1 } : { updatedAt: -1, _id: -1 };
  if (query.q) {
    filter.$text = { $search: query.q };
    sort.score = { $meta: "textScore" };
  } else if (query.cursor && query.sort !== "title" && query.sort !== "created") {
    const cursor = decodeCursor(query.cursor);
    filter.$or = [
      { updatedAt: { $lt: cursor.updatedAt } },
      { updatedAt: cursor.updatedAt, _id: { $lt: asObjectId(cursor.id, "cursor") } },
    ];
  }
  const rows = await Note.find(filter)
    .sort(sort)
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const collabs = await collaboratorMap(page.map((note) => note._id.toString()));
  const last = page.at(-1);
  const nextCursor = hasMore && last && !query.q ? encodeCursor(last.updatedAt, last._id.toString()) : null;
  return {
    notes: page.map((note) =>
      presentNote(note, {
        includeContent: false,
        collaborators: collabs.get(note._id.toString()) ?? [],
      }),
    ),
    nextCursor,
    hasMore,
    limit,
  };
};

export const createNote = async (
  userId: string,
  userName: string,
  input: { workspaceId: string; folderId?: string | null; title?: string; emoji?: string; content?: JSONContent; tags?: string[] },
) => {
  await requireWorkspace(userId, input.workspaceId);
  const note = new Note({
    workspaceId: input.workspaceId,
    folderId: input.folderId ?? null,
    ownerId: userId,
    title: input.title?.trim() ?? "",
    emoji: input.emoji ?? "",
    content: emptyDoc(),
    plainText: "",
    tags: [],
  });
  const tags = applyDerived(note, input.content ?? emptyDoc(), input.tags ?? []);
  await note.save();
  await syncTags(input.workspaceId, tags);
  await recordActivity({
    workspaceId: input.workspaceId,
    actorId: userId,
    actorName: userName,
    action: "note.created",
    noteId: note._id.toString(),
    noteTitle: note.title,
  });
  return presentNote(note);
};

export const getNote = async (userId: string, noteId: string, unlockToken?: string) => {
  const { note } = await requireNote(userId, noteId);
  let includeContent = true;
  if (note.isLocked) {
    includeContent = false;
    if (unlockToken) {
      verifyNoteUnlock(unlockToken, note._id.toString(), userId);
      includeContent = true;
    }
  }
  const collabs = await collaboratorMap([note._id.toString()]);
  const presented = presentNote(note, { includeContent, collaborators: collabs.get(note._id.toString()) ?? [] });
  if (!includeContent) presented.preview = "";
  return presented;
};

export const updateNote = async (
  userId: string,
  userName: string,
  noteId: string,
  input: {
    title?: string;
    emoji?: string;
    content?: JSONContent;
    tags?: string[];
    folderId?: string | null;
    isPinned?: boolean;
    isFavorite?: boolean;
    colorLabel?: string | null;
    cover?: { kind: "none" | "upload" | "gallery"; url?: string | null; position?: number };
    locationLabel?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    baseVersion?: number;
  },
) => {
  const { note } = await requireNote(userId, noteId, "edit");
  if (input.baseVersion && input.baseVersion !== note.version) {
    throw new ApiError(409, "This note changed somewhere else", { server: presentNote(note) });
  }
  const previousText = note.plainText;
  const previousContent = note.content;
  const previousTitle = note.title;
  if (input.title !== undefined) note.title = input.title.trim();
  if (input.emoji !== undefined) note.emoji = input.emoji;
  if (input.folderId !== undefined) note.folderId = input.folderId ? asObjectId(input.folderId, "folder") : null;
  if (input.isPinned !== undefined) note.isPinned = input.isPinned;
  if (input.isFavorite !== undefined) note.isFavorite = input.isFavorite;
  if (input.colorLabel !== undefined) note.colorLabel = input.colorLabel;
  if (input.cover) note.cover = { kind: input.cover.kind, url: input.cover.url ?? null, position: input.cover.position ?? 50 };
  if (input.locationLabel !== undefined) note.locationLabel = input.locationLabel;
  if (input.latitude !== undefined) note.latitude = input.latitude;
  if (input.longitude !== undefined) note.longitude = input.longitude;
  if (input.content) {
    const tags = applyDerived(note, input.content, input.tags ?? note.tags);
    await syncTags(note.workspaceId.toString(), tags);
  } else if (input.tags) {
    note.tags = [...new Set(input.tags.map((tag) => tag.toLowerCase()))];
    await syncTags(note.workspaceId.toString(), note.tags);
  }
  const contentChanged = input.content && plainTextFromDoc(input.content) !== previousText;
  if (contentChanged || (input.title !== undefined && input.title !== previousTitle)) {
    const last = await NoteVersion.findOne({ noteId: note._id }).sort({ createdAt: -1 });
    const stale = !last || Date.now() - new Date(last.createdAt ?? 0).getTime() > 2 * 60 * 1000;
    if (stale) {
      await NoteVersion.create({
        noteId: note._id,
        workspaceId: note.workspaceId,
        authorId: userId,
        title: previousTitle,
        content: previousContent,
        plainText: previousText,
      });
    }
  }
  note.version += 1;
  await note.save();
  await recordActivity({
    workspaceId: note.workspaceId.toString(),
    actorId: userId,
    actorName: userName,
    action: "note.updated",
    noteId: note._id.toString(),
    noteTitle: note.title || "Untitled",
  });
  return presentNote(note);
};

export const trashNote = async (userId: string, userName: string, noteId: string) => {
  const { note } = await requireNote(userId, noteId, "edit");
  note.deletedAt = new Date();
  await note.save();
  await recordActivity({
    workspaceId: note.workspaceId.toString(),
    actorId: userId,
    actorName: userName,
    action: "note.trashed",
    noteId: note._id.toString(),
    noteTitle: note.title,
  });
};

export const restoreNote = async (userId: string, noteId: string) => {
  const { note } = await requireNote(userId, noteId);
  note.deletedAt = null;
  await note.save();
  return presentNote(note);
};

export const destroyNote = async (userId: string, noteId: string) => {
  const { note, role } = await requireNote(userId, noteId);
  if (role === "member" && note.ownerId.toString() !== userId) throw forbidden();
  const files = await Attachment.find({ noteId: note._id });
  await Promise.all(files.map((file) => removeStored(file.storagePath)));
  await Attachment.deleteMany({ noteId: note._id });
  await NoteVersion.deleteMany({ noteId: note._id });
  await Comment.deleteMany({ noteId: note._id });
  await Reminder.deleteMany({ noteId: note._id });
  await Share.deleteMany({ noteId: note._id });
  await Note.deleteOne({ _id: note._id });
};

export const emptyTrash = async (userId: string, workspaceId: string) => {
  await requireWorkspace(userId, workspaceId);
  const notes = await Note.find({ workspaceId, deletedAt: { $ne: null } });
  for (const note of notes) await destroyNote(userId, note._id.toString());
  return { removed: notes.length };
};

export const duplicateNote = async (userId: string, userName: string, noteId: string) => {
  const { note } = await requireNote(userId, noteId);
  return createNote(userId, userName, {
    workspaceId: note.workspaceId.toString(),
    folderId: note.folderId ? note.folderId.toString() : null,
    title: note.title ? `Copy of ${note.title}` : "Copy",
    emoji: note.emoji,
    content: note.content as JSONContent,
    tags: note.tags,
  });
};

export const lockNote = async (userId: string, noteId: string, password: string) => {
  const { note } = await requireNote(userId, noteId, "edit");
  note.lockHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  note.isLocked = true;
  await note.save();
  return { locked: true };
};

export const unlockNote = async (userId: string, noteId: string, password: string) => {
  const { note } = await requireNote(userId, noteId);
  if (!note.isLocked || !note.lockHash) return { unlockToken: null, note: presentNote(note) };
  const matches = await bcrypt.compare(password, note.lockHash);
  if (!matches) throw forbidden("Incorrect note password");
  const unlockToken = signNoteUnlock(userId, note._id.toString());
  return { unlockToken, note: presentNote(note) };
};

export const clearLock = async (userId: string, noteId: string, password: string) => {
  const { note } = await requireNote(userId, noteId, "edit");
  if (note.lockHash && !(await bcrypt.compare(password, note.lockHash))) throw forbidden("Incorrect note password");
  note.lockHash = null;
  note.isLocked = false;
  await note.save();
};

export const addAttachment = async (userId: string, noteId: string, file: Express.Multer.File, kind: "image" | "audio" | "file") => {
  const { note } = await requireNote(userId, noteId, "edit");
  const stored = await saveBuffer(file.buffer, `${note._id.toString()}-${Date.now()}`, file.mimetype, kind);
  const attachment = await Attachment.create({
    noteId: note._id,
    workspaceId: note.workspaceId,
    uploadedBy: userId,
    kind,
    fileName: file.originalname,
    mimeType: stored.mimeType,
    size: stored.size,
    storagePath: stored.storagePath,
  });
  if (kind === "image") note.hasImage = true;
  if (kind === "audio") note.hasAudio = true;
  await note.save();
  return {
    id: attachment._id.toString(),
    kind,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: `/api/v1/files/${attachment._id.toString()}?token=${signFileToken(userId, attachment._id.toString())}`,
  };
};

export const listVersions = async (userId: string, noteId: string) => {
  await requireNote(userId, noteId);
  const versions = await NoteVersion.find({ noteId }).sort({ createdAt: -1 }).limit(50);
  return versions.map((version) => ({
    id: version._id.toString(),
    title: version.title,
    plainText: version.plainText,
    createdAt: version.createdAt,
    authorId: version.authorId.toString(),
  }));
};

export const restoreVersion = async (userId: string, userName: string, noteId: string, versionId: string) => {
  const { note } = await requireNote(userId, noteId, "edit");
  const version = await NoteVersion.findOne({ _id: versionId, noteId: note._id });
  if (!version) throw notFound("Version not found");
  return updateNote(userId, userName, noteId, {
    title: version.title,
    content: version.content as JSONContent,
    baseVersion: note.version,
  });
};

export const purgeExpiredTrash = async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const notes = await Note.find({ deletedAt: { $ne: null, $lt: cutoff } }).limit(200);
  for (const note of notes) {
    const files = await Attachment.find({ noteId: note._id });
    await Promise.all(files.map((file) => removeStored(file.storagePath)));
    await Attachment.deleteMany({ noteId: note._id });
    await NoteVersion.deleteMany({ noteId: note._id });
    await Comment.deleteMany({ noteId: note._id });
    await Reminder.deleteMany({ noteId: note._id });
    await Share.deleteMany({ noteId: note._id });
    await Note.deleteOne({ _id: note._id });
  }
  return notes.length;
};
