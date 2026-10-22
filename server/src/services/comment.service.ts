import { notFound } from "../libs/apiError.js";
import { Comment } from "../models/comment.model.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { requireNote } from "./access.service.js";

export const listComments = async (userId: string, noteId: string) => {
  await requireNote(userId, noteId);
  const rows = await Comment.find({ noteId }).sort({ createdAt: 1 });
  return rows.map((row) => ({
    id: row._id.toString(),
    body: row.body,
    quote: row.quote,
    authorId: row.authorId.toString(),
    authorName: row.authorName,
    resolved: row.resolved,
    createdAt: row.createdAt,
  }));
};

export const addComment = async (userId: string, userName: string, noteId: string, body: string, quote = "") => {
  const { note } = await requireNote(userId, noteId);
  const mentions = [...new Set((body.match(/@([\w.+-]+@[\w.-]+)/g) ?? []).map((item) => item.slice(1).toLowerCase()))];
  const comment = await Comment.create({
    noteId: note._id,
    workspaceId: note.workspaceId,
    authorId: userId,
    authorName: userName,
    body: body.trim(),
    quote,
    mentions,
  });
  for (const email of mentions) {
    const person = await User.findOne({ email });
    if (person) {
      await Notification.create({
        userId: person._id,
        title: `${userName} mentioned you`,
        body: body.slice(0, 140),
        noteId: note._id,
        kind: "mention",
      });
    }
  }
  return {
    id: comment._id.toString(),
    body: comment.body,
    quote: comment.quote,
    authorId: userId,
    authorName: userName,
    resolved: false,
    createdAt: comment.createdAt,
  };
};

export const resolveComment = async (userId: string, noteId: string, commentId: string, resolved: boolean) => {
  await requireNote(userId, noteId, "edit");
  const comment = await Comment.findOne({ _id: commentId, noteId });
  if (!comment) throw notFound("Comment not found");
  comment.resolved = resolved;
  await comment.save();
};
