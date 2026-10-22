import { Activity } from "../models/activity.model.js";
import { asObjectId } from "../utils/objectId.js";

export const recordActivity = async (input: {
  workspaceId: string;
  actorId: string;
  actorName: string;
  action: string;
  noteId?: string | null;
  noteTitle?: string;
  meta?: Record<string, unknown>;
}) => {
  await Activity.create({
    workspaceId: asObjectId(input.workspaceId, "workspace"),
    actorId: asObjectId(input.actorId, "user"),
    actorName: input.actorName,
    action: input.action,
    noteId: input.noteId ? asObjectId(input.noteId, "note") : null,
    noteTitle: input.noteTitle ?? "",
    meta: input.meta ?? {},
  });
};
