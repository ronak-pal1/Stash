import { Router } from "express";
import * as noteController from "../controllers/note.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  attachmentParamsSchema,
  createNoteSchema,
  listNotesSchema,
  noteIdParamsSchema,
  updateNoteSchema,
} from "../validators/note.validator.js";

export const noteRouter = Router();

noteRouter.use(requireAuth);

noteRouter.get("/", validate(listNotesSchema), noteController.listNotes);
noteRouter.post("/", validate(createNoteSchema), noteController.createNote);
noteRouter.get("/:noteId", validate(noteIdParamsSchema), noteController.getNote);
noteRouter.patch("/:noteId", validate(updateNoteSchema), noteController.updateNote);
noteRouter.delete("/:noteId", validate(noteIdParamsSchema), noteController.deleteNote);

noteRouter.post(
  "/:noteId/attachments",
  validate(noteIdParamsSchema),
  upload.single("file"),
  noteController.addAttachment,
);

noteRouter.delete(
  "/:noteId/attachments/:attachmentId",
  validate(attachmentParamsSchema),
  noteController.deleteAttachment,
);

noteRouter.get(
  "/:noteId/attachments/:attachmentId/url",
  validate(attachmentParamsSchema),
  noteController.getAttachmentUrl,
);
