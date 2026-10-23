import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ApiError } from "../libs/apiError.js";
import { sendError } from "../libs/http.js";

export const notFoundHandler = (req: Request, res: Response) => {
  sendError(res, 404, `No route for ${req.method} ${req.path}`);
};

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ApiError) {
    sendError(res, error.statusCode, error.message, error.details);
    return;
  }
  logger.error({ err: error, requestId: req.requestId }, "unhandled error");
  const message = env.NODE_ENV === "production" ? "Something went wrong" : error instanceof Error ? error.message : "Something went wrong";
  sendError(res, 500, message);
};
