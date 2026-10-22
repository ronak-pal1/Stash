import type { RequestHandler } from "express";
import multer from "multer";
import { badRequest } from "../libs/apiError.js";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const audioTypes = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-m4a"]);
const importTypes = new Set([
  "text/plain",
  "text/markdown",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
  "application/octet-stream",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
});

export const uploadSingle = (field: string, kind: "image" | "audio" | "import"): RequestHandler => (req, res, next) => {
  upload.single(field)(req, res, (error: unknown) => {
    if (error) {
      next(error instanceof Error ? badRequest(error.message) : badRequest("Upload failed"));
      return;
    }
    const file = req.file;
    if (!file) {
      next(badRequest("Choose a file"));
      return;
    }
    const allowed = kind === "image" ? imageTypes : kind === "audio" ? audioTypes : importTypes;
    const name = file.originalname.toLowerCase();
    const extensionOk =
      kind === "import" &&
      (name.endsWith(".md") || name.endsWith(".txt") || name.endsWith(".html") || name.endsWith(".json") || name.endsWith(".enex"));
    if (!allowed.has(file.mimetype) && !extensionOk) {
      next(badRequest("This file type is not allowed"));
      return;
    }
    if (kind === "image" && file.size > 8 * 1024 * 1024) {
      next(badRequest("Images must be 8 MB or smaller"));
      return;
    }
    next();
  });
};
