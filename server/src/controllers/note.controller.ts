import { ApiError } from "../libs/apiError.js";
import { asyncHandler } from "../libs/asyncHandler.js";
import { sendSuccess } from "../libs/apiResponse.js";
import { getRequestUserId } from "../middlewares/auth.middleware.js";
import * as noteService from "../services/note.service.js";
import type {
  AttachmentParams,
  CreateNoteInput,
  ListNotesInput,
  NoteIdParams,
  UpdateNoteInput,
} from "../validators/note.validator.js";

export const createNote = asyncHandler(async (req, res) => {
  const { body } = req.validated as CreateNoteInput;
  const note = await noteService.createNote(getRequestUserId(req), body);
  sendSuccess(res, 201, "Note created", note);
});

export const listNotes = asyncHandler(async (req, res) => {
  const { query } = req.validated as ListNotesInput;
  const result = await noteService.listNotes(getRequestUserId(req), query);
  sendSuccess(res, 200, "Notes fetched", result);
});

export const getNote = asyncHandler(async (req, res) => {
  const { params } = req.validated as NoteIdParams;
  const note = await noteService.getNote(getRequestUserId(req), params.noteId);
  sendSuccess(res, 200, "Note fetched", note);
});

export const updateNote = asyncHandler(async (req, res) => {
  const { params, body } = req.validated as UpdateNoteInput;
  const note = await noteService.updateNote(getRequestUserId(req), params.noteId, body);
  sendSuccess(res, 200, "Note updated", note);
});

export const deleteNote = asyncHandler(async (req, res) => {
  const { params } = req.validated as NoteIdParams;
  const result = await noteService.deleteNote(getRequestUserId(req), params.noteId);
  sendSuccess(res, 200, "Note deleted", result);
});

export const addAttachment = asyncHandler(async (req, res) => {
  const { params } = req.validated as NoteIdParams;
  const file = req.file;

  if (!file) {
    throw new ApiError(400, "File is required");
  }

  const note = await noteService.addAttachment(getRequestUserId(req), params.noteId, file);
  sendSuccess(res, 201, "Attachment uploaded", note);
});

export const deleteAttachment = asyncHandler(async (req, res) => {
  const { params } = req.validated as AttachmentParams;
  const note = await noteService.deleteAttachment(
    getRequestUserId(req),
    params.noteId,
    params.attachmentId,
  );
  sendSuccess(res, 200, "Attachment deleted", note);
});

export const getAttachmentUrl = asyncHandler(async (req, res) => {
  const { params } = req.validated as AttachmentParams;
  const download = await noteService.getAttachmentDownloadUrl(
    getRequestUserId(req),
    params.noteId,
    params.attachmentId,
  );
  sendSuccess(res, 200, "Download URL created", download);
});
