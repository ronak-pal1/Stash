import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authRateLimit } from "../middlewares/rateLimit.middleware.js";
import { requireUser } from "../middlewares/auth.middleware.js";
import { uploadSingle } from "../middlewares/upload.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { sendData } from "../libs/http.js";
import { Attachment } from "../models/attachment.model.js";
import { User } from "../models/user.model.js";
import { Activity } from "../models/activity.model.js";
import { refreshCookieName, verifyFileToken } from "../utils/tokens.js";
import * as auth from "../services/auth.service.js";
import * as workspaces from "../services/workspace.service.js";
import * as folders from "../services/folder.service.js";
import * as notes from "../services/note.service.js";
import * as tags from "../services/tag.service.js";
import * as templates from "../services/template.service.js";
import * as shares from "../services/share.service.js";
import * as reminders from "../services/reminder.service.js";
import * as comments from "../services/comment.service.js";
import * as transfer from "../services/importExport.service.js";
import { openStored } from "../services/storage.service.js";
import { publicVapidKey, saveSubscription } from "../services/push.service.js";
import { badRequest, notFound } from "../libs/apiError.js";
import { requireWorkspace } from "../services/access.service.js";
import type { JSONContent } from "../utils/content.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const param = (value: string | string[] | undefined) => {
  const found = Array.isArray(value) ? value[0] : value;
  if (!found) throw badRequest("Missing parameter");
  return found;
};
const password = z.string().min(8).max(72);
const contentSchema = z.custom<JSONContent>((value) => typeof value === "object" && value !== null);

export const v1 = Router();

const emailSchema = z.email();

v1.post(
  "/auth/register",
  authRateLimit,
  validate(z.object({ name: z.string().trim().min(1).max(80), email: emailSchema, password })),
  async (req, res) => {
    const data = await auth.registerUser(req.body, res);
    sendData(res, data, 201);
  },
);

v1.post(
  "/auth/login",
  authRateLimit,
  validate(z.object({ email: emailSchema, password: z.string().min(1) })),
  async (req, res) => {
    sendData(res, await auth.loginUser(req.body, res));
  },
);

v1.post("/auth/refresh", authRateLimit, async (req, res) => {
  if (req.header("x-stash-client") !== "web") throw badRequest("Missing client header");
  const token = req.cookies?.[refreshCookieName] as string | undefined;
  sendData(res, await auth.refreshSession(token, res));
});

v1.post("/auth/logout", async (req, res) => {
  await auth.logoutUser(req.cookies?.[refreshCookieName] as string | undefined, res);
  sendData(res, { loggedOut: true });
});

v1.post("/auth/forgot", authRateLimit, validate(z.object({ email: emailSchema })), async (req, res) => {
  await auth.requestPasswordReset(req.body.email);
  sendData(res, { sent: true });
});

v1.post("/auth/reset", authRateLimit, validate(z.object({ token: z.string().min(10), password })), async (req, res) => {
  await auth.resetPassword(req.body.token, req.body.password);
  sendData(res, { reset: true });
});

v1.get("/auth/me", requireUser, async (req, res) => {
  sendData(res, await auth.getMe(req.userId!));
});

v1.patch("/auth/me", requireUser, validate(z.object({ name: z.string().trim().min(1).max(80).optional() })), async (req, res) => {
  sendData(res, await auth.updateProfile(req.userId!, req.body));
});

v1.post("/auth/avatar", requireUser, uploadSingle("file", "image"), async (req, res) => {
  sendData(res, await auth.saveAvatar(req.userId!, req.file!));
});

v1.post(
  "/auth/password",
  requireUser,
  validate(z.object({ current: z.string().min(1), next: password })),
  async (req, res) => {
    await auth.changePassword(req.userId!, req.body.current, req.body.next);
    sendData(res, { changed: true });
  },
);

v1.delete("/auth/me", requireUser, validate(z.object({ password: z.string().min(1) })), async (req, res) => {
  await auth.deleteAccount(req.userId!, req.body.password);
  auth.clearRefreshCookie(res);
  sendData(res, { deleted: true });
});

v1.post("/auth/plan", requireUser, validate(z.object({ plan: z.enum(["free", "pro", "team"]) })), async (req, res) => {
  sendData(res, await auth.setPlan(req.userId!, req.body.plan));
});

v1.get("/workspaces", requireUser, async (req, res) => {
  sendData(res, await workspaces.listWorkspaces(req.userId!));
});

v1.post("/workspaces", requireUser, validate(z.object({ name: z.string().trim().min(1).max(80) })), async (req, res) => {
  sendData(res, await workspaces.createWorkspace(req.userId!, req.body.name), 201);
});

v1.patch(
  "/workspaces/:workspaceId",
  requireUser,
  validate(z.object({ workspaceId: objectId }), "params"),
  validate(z.object({ name: z.string().trim().min(1).max(80).optional(), icon: z.string().max(40).optional() })),
  async (req, res) => {
    sendData(res, await workspaces.updateWorkspace(req.userId!, param(req.params.workspaceId), req.body));
  },
);

v1.post(
  "/workspaces/:workspaceId/invites",
  requireUser,
  validate(z.object({ workspaceId: objectId }), "params"),
  validate(z.object({ email: emailSchema, role: z.enum(["admin", "member"]).default("member") })),
  async (req, res) => {
    sendData(res, await workspaces.inviteToWorkspace(req.userId!, param(req.params.workspaceId), req.body.email, req.body.role), 201);
  },
);

v1.post(
  "/workspaces/join",
  requireUser,
  validate(z.object({ token: z.string().min(10), email: emailSchema, workspaceId: objectId })),
  async (req, res) => {
    sendData(res, await workspaces.joinWorkspace(req.userId!, req.body.token, req.body.email, req.body.workspaceId));
  },
);

v1.patch(
  "/workspaces/:workspaceId/members/:memberId",
  requireUser,
  validate(z.object({ workspaceId: objectId, memberId: objectId }), "params"),
  validate(z.object({ role: z.enum(["admin", "member"]) })),
  async (req, res) => {
    sendData(res, await workspaces.updateMember(req.userId!, param(req.params.workspaceId), param(req.params.memberId), req.body.role));
  },
);

v1.delete(
  "/workspaces/:workspaceId/members/:memberId",
  requireUser,
  validate(z.object({ workspaceId: objectId, memberId: objectId }), "params"),
  async (req, res) => {
    await workspaces.removeMember(req.userId!, param(req.params.workspaceId), param(req.params.memberId));
    sendData(res, { removed: true });
  },
);

v1.get("/folders", requireUser, validate(z.object({ workspaceId: objectId }), "query"), async (req, res) => {
  sendData(res, await folders.listFolders(req.userId!, String(req.query.workspaceId)));
});

v1.post(
  "/folders",
  requireUser,
  validate(z.object({
    workspaceId: objectId,
    name: z.string().trim().min(1).max(80),
    icon: z.string().max(40).optional(),
    color: z.string().max(20).optional(),
    parentId: objectId.nullable().optional(),
  })),
  async (req, res) => {
    sendData(res, await folders.createFolder(req.userId!, req.body), 201);
  },
);

v1.patch(
  "/folders/:folderId",
  requireUser,
  validate(z.object({ folderId: objectId }), "params"),
  validate(z.object({ name: z.string().trim().min(1).max(80).optional(), icon: z.string().max(40).optional(), color: z.string().max(20).optional() })),
  async (req, res) => {
    sendData(res, await folders.updateFolder(req.userId!, param(req.params.folderId), req.body));
  },
);

v1.delete("/folders/:folderId", requireUser, validate(z.object({ folderId: objectId }), "params"), async (req, res) => {
  await folders.deleteFolder(req.userId!, param(req.params.folderId));
  sendData(res, { deleted: true });
});

v1.post(
  "/folders/reorder",
  requireUser,
  validate(z.object({ workspaceId: objectId, ids: z.array(objectId).min(1) })),
  async (req, res) => {
    sendData(res, await folders.reorderFolders(req.userId!, req.body.workspaceId, req.body.ids));
  },
);

const flag = z.enum(["true", "false"]).optional();
const noteQuery = z.object({
  workspaceId: objectId,
  q: z.string().max(120).optional(),
  tag: z.string().max(40).optional(),
  folderId: objectId.optional(),
  pinned: flag,
  favorite: flag,
  hasChecklist: flag,
  hasImage: flag,
  hasAudio: flag,
  from: z.string().optional(),
  to: z.string().optional(),
  trashed: flag,
  sort: z.enum(["updated", "created", "title"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

v1.get("/notes", requireUser, validate(noteQuery, "query"), async (req, res) => {
  const query = req.query as unknown as z.infer<typeof noteQuery>;
  const page = await notes.listNotes(req.userId!, {
    ...query,
    pinned: query.pinned === "true",
    favorite: query.favorite === "true",
    hasChecklist: query.hasChecklist === "true",
    hasImage: query.hasImage === "true",
    hasAudio: query.hasAudio === "true",
    trashed: query.trashed === "true",
  });
  sendData(res, { notes: page.notes }, 200, { nextCursor: page.nextCursor, hasMore: page.hasMore, limit: page.limit });
});

v1.post(
  "/notes",
  requireUser,
  validate(z.object({
    workspaceId: objectId,
    folderId: objectId.nullable().optional(),
    title: z.string().max(200).optional(),
    emoji: z.string().max(16).optional(),
    content: contentSchema.optional(),
    tags: z.array(z.string().max(40)).max(30).optional(),
  })),
  async (req, res) => {
    sendData(res, await notes.createNote(req.userId!, req.userName ?? "Someone", req.body), 201);
  },
);

v1.get("/notes/:noteId", requireUser, validate(z.object({ noteId: objectId }), "params"), async (req, res) => {
  sendData(res, await notes.getNote(req.userId!, param(req.params.noteId), req.header("x-note-unlock")));
});

v1.patch(
  "/notes/:noteId",
  requireUser,
  validate(z.object({ noteId: objectId }), "params"),
  validate(z.object({
    title: z.string().max(200).optional(),
    emoji: z.string().max(16).optional(),
    content: contentSchema.optional(),
    tags: z.array(z.string().max(40)).max(30).optional(),
    folderId: objectId.nullable().optional(),
    isPinned: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
    colorLabel: z.string().max(20).nullable().optional(),
    cover: z.object({
      kind: z.enum(["none", "upload", "gallery"]),
      url: z.string().nullable().optional(),
      position: z.number().min(0).max(100).optional(),
    }).optional(),
    locationLabel: z.string().max(80).nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    baseVersion: z.number().int().optional(),
  })),
  async (req, res) => {
    sendData(res, await notes.updateNote(req.userId!, req.userName ?? "Someone", param(req.params.noteId), req.body));
  },
);

v1.delete("/notes/:noteId", requireUser, validate(z.object({ noteId: objectId }), "params"), async (req, res) => {
  await notes.trashNote(req.userId!, req.userName ?? "Someone", param(req.params.noteId));
  sendData(res, { trashed: true });
});

v1.post("/notes/:noteId/restore", requireUser, validate(z.object({ noteId: objectId }), "params"), async (req, res) => {
  sendData(res, await notes.restoreNote(req.userId!, param(req.params.noteId)));
});

v1.delete("/notes/:noteId/forever", requireUser, validate(z.object({ noteId: objectId }), "params"), async (req, res) => {
  await notes.destroyNote(req.userId!, param(req.params.noteId));
  sendData(res, { deleted: true });
});

v1.post("/notes/:noteId/duplicate", requireUser, validate(z.object({ noteId: objectId }), "params"), async (req, res) => {
  sendData(res, await notes.duplicateNote(req.userId!, req.userName ?? "Someone", param(req.params.noteId)), 201);
});

v1.post("/trash/empty", requireUser, validate(z.object({ workspaceId: objectId })), async (req, res) => {
  sendData(res, await notes.emptyTrash(req.userId!, req.body.workspaceId));
});

v1.post("/notes/:noteId/lock", requireUser, validate(z.object({ noteId: objectId }), "params"), validate(z.object({ password })), async (req, res) => {
  sendData(res, await notes.lockNote(req.userId!, param(req.params.noteId), req.body.password));
});

v1.post("/notes/:noteId/unlock", requireUser, validate(z.object({ noteId: objectId }), "params"), validate(z.object({ password: z.string().min(1) })), async (req, res) => {
  sendData(res, await notes.unlockNote(req.userId!, param(req.params.noteId), req.body.password));
});

v1.post("/notes/:noteId/attachments", requireUser, validate(z.object({ noteId: objectId }), "params"), uploadSingle("file", "image"), async (req, res) => {
  const kind = req.file!.mimetype.startsWith("audio/") ? "audio" : req.file!.mimetype.startsWith("image/") ? "image" : "file";
  sendData(res, await notes.addAttachment(req.userId!, param(req.params.noteId), req.file!, kind), 201);
});

v1.post("/notes/:noteId/audio", requireUser, validate(z.object({ noteId: objectId }), "params"), uploadSingle("file", "audio"), async (req, res) => {
  sendData(res, await notes.addAttachment(req.userId!, param(req.params.noteId), req.file!, "audio"), 201);
});

v1.get("/notes/:noteId/versions", requireUser, validate(z.object({ noteId: objectId }), "params"), async (req, res) => {
  sendData(res, await notes.listVersions(req.userId!, param(req.params.noteId)));
});

v1.post("/notes/:noteId/versions/:versionId/restore", requireUser, validate(z.object({ noteId: objectId, versionId: objectId }), "params"), async (req, res) => {
  sendData(res, await notes.restoreVersion(req.userId!, req.userName ?? "Someone", param(req.params.noteId), param(req.params.versionId)));
});

v1.get("/notes/:noteId/comments", requireUser, validate(z.object({ noteId: objectId }), "params"), async (req, res) => {
  sendData(res, await comments.listComments(req.userId!, param(req.params.noteId)));
});

v1.post(
  "/notes/:noteId/comments",
  requireUser,
  validate(z.object({ noteId: objectId }), "params"),
  validate(z.object({ body: z.string().trim().min(1).max(4000), quote: z.string().max(500).optional() })),
  async (req, res) => {
    sendData(res, await comments.addComment(req.userId!, req.userName ?? "Someone", param(req.params.noteId), req.body.body, req.body.quote), 201);
  },
);

v1.patch(
  "/notes/:noteId/comments/:commentId",
  requireUser,
  validate(z.object({ noteId: objectId, commentId: objectId }), "params"),
  validate(z.object({ resolved: z.boolean() })),
  async (req, res) => {
    await comments.resolveComment(req.userId!, param(req.params.noteId), param(req.params.commentId), req.body.resolved);
    sendData(res, { resolved: req.body.resolved });
  },
);

v1.get("/notes/:noteId/shares", requireUser, validate(z.object({ noteId: objectId }), "params"), async (req, res) => {
  sendData(res, await shares.listShares(req.userId!, param(req.params.noteId)));
});

v1.post(
  "/notes/:noteId/shares",
  requireUser,
  validate(z.object({ noteId: objectId }), "params"),
  validate(z.object({ email: emailSchema, role: z.enum(["viewer", "editor"]).default("viewer") })),
  async (req, res) => {
    sendData(res, await shares.shareWithEmail(req.userId!, req.userName ?? "Someone", param(req.params.noteId), req.body.email, req.body.role), 201);
  },
);

v1.post(
  "/notes/:noteId/links",
  requireUser,
  validate(z.object({ noteId: objectId }), "params"),
  validate(z.object({ expiresAt: z.string().nullable().optional() })),
  async (req, res) => {
    sendData(res, await shares.createPublicLink(req.userId!, param(req.params.noteId), req.body.expiresAt), 201);
  },
);

v1.delete("/notes/:noteId/shares/:shareId", requireUser, validate(z.object({ noteId: objectId, shareId: objectId }), "params"), async (req, res) => {
  await shares.revokeShare(req.userId!, param(req.params.noteId), param(req.params.shareId));
  sendData(res, { revoked: true });
});

v1.get("/public/notes/:token", async (req, res) => {
  sendData(res, await shares.readPublicNote(param(req.params.token)));
});

v1.get("/tags", requireUser, validate(z.object({ workspaceId: objectId }), "query"), async (req, res) => {
  sendData(res, await tags.listTags(req.userId!, String(req.query.workspaceId)));
});

v1.patch(
  "/tags/:tagId",
  requireUser,
  validate(z.object({ tagId: objectId }), "params"),
  validate(z.object({ workspaceId: objectId, name: z.string().trim().min(1).max(40) })),
  async (req, res) => {
    sendData(res, await tags.renameTag(req.userId!, req.body.workspaceId, param(req.params.tagId), req.body.name));
  },
);

v1.delete("/tags/:tagId", requireUser, validate(z.object({ tagId: objectId }), "params"), validate(z.object({ workspaceId: objectId })), async (req, res) => {
  await tags.deleteTag(req.userId!, req.body.workspaceId, param(req.params.tagId));
  sendData(res, { deleted: true });
});

v1.get("/templates", requireUser, validate(z.object({ workspaceId: objectId }), "query"), async (req, res) => {
  sendData(res, await templates.listTemplates(req.userId!, String(req.query.workspaceId)));
});

v1.post(
  "/templates",
  requireUser,
  validate(z.object({ workspaceId: objectId, name: z.string().min(1).max(80), content: contentSchema, emoji: z.string().max(16).optional() })),
  async (req, res) => {
    sendData(res, await templates.createTemplateFromNote(req.userId!, req.body.workspaceId, req.body.name, req.body.content, req.body.emoji), 201);
  },
);

v1.post(
  "/templates/:templateId/use",
  requireUser,
  validate(z.object({ templateId: objectId }), "params"),
  validate(z.object({ workspaceId: objectId, folderId: objectId.nullable().optional() })),
  async (req, res) => {
    sendData(res, await templates.useTemplate(req.userId!, req.userName ?? "Someone", param(req.params.templateId), req.body.workspaceId, req.body.folderId), 201);
  },
);

v1.post("/import", requireUser, uploadSingle("file", "import"), async (req, res) => {
  const workspaceId = String(req.body.workspaceId ?? "");
  const folderId = req.body.folderId ? String(req.body.folderId) : null;
  if (!/^[a-f\d]{24}$/i.test(workspaceId)) throw badRequest("workspaceId is required");
  sendData(res, await transfer.importFile(req.userId!, req.userName ?? "Someone", workspaceId, folderId, req.file!), 201);
});

v1.get("/notes/:noteId/export", requireUser, validate(z.object({ noteId: objectId }), "params"), async (req, res) => {
  const format = z.enum(["md", "html", "json", "pdf"]).parse(req.query.format ?? "md");
  const file = await transfer.exportNote(req.userId!, param(req.params.noteId), format);
  res.setHeader("Content-Type", file.mime);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.filename)}"`);
  res.send(file.body);
});

v1.post(
  "/export",
  requireUser,
  validate(z.object({ workspaceId: objectId, noteIds: z.array(objectId).min(1).max(100), format: z.enum(["md", "html", "json"]).default("md") })),
  async (req, res) => {
    const file = await transfer.exportBulk(req.userId!, req.body.workspaceId, req.body.noteIds, req.body.format);
    res.setHeader("Content-Type", file.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.body);
  },
);

v1.get("/reminders", requireUser, validate(z.object({ workspaceId: objectId, from: z.string().optional(), to: z.string().optional() }), "query"), async (req, res) => {
  sendData(res, await reminders.listReminders(req.userId!, String(req.query.workspaceId), req.query.from ? String(req.query.from) : undefined, req.query.to ? String(req.query.to) : undefined));
});

v1.post(
  "/reminders",
  requireUser,
  validate(z.object({
    noteId: objectId,
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(4),
    repeat: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  })),
  async (req, res) => {
    sendData(res, await reminders.createReminder(req.userId!, req.body), 201);
  },
);

v1.patch("/reminders/:reminderId", requireUser, validate(z.object({ reminderId: objectId }), "params"), validate(z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  times: z.array(z.string()).optional(),
  repeat: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
  status: z.enum(["pending", "done", "snoozed"]).optional(),
})), async (req, res) => {
  sendData(res, await reminders.updateReminder(req.userId!, param(req.params.reminderId), req.body));
});

v1.post("/reminders/:reminderId/snooze", requireUser, validate(z.object({ reminderId: objectId }), "params"), validate(z.object({ minutes: z.number().int().positive().max(10080) })), async (req, res) => {
  sendData(res, await reminders.snoozeReminder(req.userId!, param(req.params.reminderId), req.body.minutes));
});

v1.delete("/reminders/:reminderId", requireUser, validate(z.object({ reminderId: objectId }), "params"), async (req, res) => {
  await reminders.deleteReminder(req.userId!, param(req.params.reminderId));
  sendData(res, { deleted: true });
});

v1.get("/notifications", requireUser, async (req, res) => {
  sendData(res, await reminders.listNotifications(req.userId!));
});

v1.post("/notifications/:notificationId/read", requireUser, validate(z.object({ notificationId: objectId }), "params"), async (req, res) => {
  await reminders.markNotificationRead(req.userId!, param(req.params.notificationId));
  sendData(res, { read: true });
});

v1.get("/activity", requireUser, validate(z.object({ workspaceId: objectId }), "query"), async (req, res) => {
  await requireWorkspace(req.userId!, String(req.query.workspaceId));
  const rows = await Activity.find({ workspaceId: String(req.query.workspaceId) }).sort({ createdAt: -1 }).limit(40);
  const member = rows;
  sendData(res, member.map((row) => ({
    id: row._id.toString(),
    actorName: row.actorName,
    action: row.action,
    noteId: row.noteId ? row.noteId.toString() : null,
    noteTitle: row.noteTitle,
    createdAt: row.createdAt,
  })));
});

v1.get("/push/vapid", requireUser, (_req, res) => {
  sendData(res, { publicKey: publicVapidKey() });
});

v1.post("/push/subscribe", requireUser, validate(z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
})), async (req, res) => {
  await saveSubscription(req.userId!, req.body);
  sendData(res, { subscribed: true });
});

v1.get("/files/avatar/:userId", async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user?.avatarPath) throw notFound("No avatar");
  const opened = await openStored(user.avatarPath);
  if (opened.redirect) {
    res.redirect(opened.redirect);
    return;
  }
  res.setHeader("Content-Type", "image/webp");
  opened.stream?.pipe(res);
});

v1.get("/files/:fileId", async (req, res) => {
  const token = String(req.query.token ?? "");
  const claims = verifyFileToken(token);
  if (claims.fid !== req.params.fileId) throw notFound("File not found");
  const file = await Attachment.findById(req.params.fileId);
  if (!file) throw notFound("File not found");
  const opened = await openStored(file.storagePath);
  if (opened.redirect) {
    res.redirect(opened.redirect);
    return;
  }
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Cache-Control", "private, max-age=300");
  opened.stream?.pipe(res);
});

v1.get("/health", (_req, res) => {
  sendData(res, { status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});
