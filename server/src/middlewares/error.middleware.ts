import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { MAX_UPLOAD_BYTES } from "../config/limits.js";
import { ApiError } from "../libs/apiError.js";
import { formatZodError } from "../libs/formatZodError.js";

const isDuplicateKey = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: number }).code === 11000;

const isJsonParseError = (error: unknown) =>
  error instanceof SyntaxError && "status" in error && (error as { status?: number }).status === 400;

export const errorHandler = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      details: formatZodError(err),
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `File is too large. Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`
        : err.message;

    res.status(400).json({ success: false, message });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ success: false, message: "Invalid id" });
    return;
  }

  if (isDuplicateKey(err)) {
    res.status(409).json({ success: false, message: "Email is already registered" });
    return;
  }

  if (isJsonParseError(err)) {
    res.status(400).json({ success: false, message: "Invalid JSON body" });
    return;
  }

  if (env.NODE_ENV !== "test") {
    console.error(err);
  }

  res.status(500).json({ success: false, message: "Internal server error" });
};
