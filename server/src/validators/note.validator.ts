import { z } from "zod";
import { objectIdSchema } from "./common.js";

const tagSchema = z
  .string()
  .trim()
  .min(1, "Tags cannot be empty")
  .max(40, "Tags must be at most 40 characters");

export const createNoteSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title must be at most 200 characters"),
    content: z.string().max(100_000, "Content must be at most 100000 characters").optional(),
    tags: z.array(tagSchema).max(20, "A note can have at most 20 tags").optional(),
    isPinned: z.boolean().optional(),
  }),
});

export const updateNoteSchema = z.object({
  params: z.object({
    noteId: objectIdSchema,
  }),
  body: z
    .object({
      title: z
        .string()
        .trim()
        .min(1, "Title is required")
        .max(200, "Title must be at most 200 characters")
        .optional(),
      content: z.string().max(100_000, "Content must be at most 100000 characters").optional(),
      tags: z.array(tagSchema).max(20, "A note can have at most 20 tags").optional(),
      isPinned: z.boolean().optional(),
      isArchived: z.boolean().optional(),
    })
    .refine((body) => Object.values(body).some((value) => value !== undefined), {
      message: "At least one field is required",
    }),
});

export const listNotesSchema = z.object({
  query: z.object({
    q: z.string().trim().max(200).optional(),
    tag: z.string().trim().min(1).max(40).optional(),
    archived: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});

export const noteIdParamsSchema = z.object({
  params: z.object({
    noteId: objectIdSchema,
  }),
});

export const attachmentParamsSchema = z.object({
  params: z.object({
    noteId: objectIdSchema,
    attachmentId: objectIdSchema,
  }),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListNotesInput = z.infer<typeof listNotesSchema>;
export type NoteIdParams = z.infer<typeof noteIdParamsSchema>;
export type AttachmentParams = z.infer<typeof attachmentParamsSchema>;
