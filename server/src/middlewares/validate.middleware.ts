import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "../libs/apiError.js";
import { formatZodError } from "../libs/formatZodError.js";

export const validate =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const details = result.error instanceof ZodError ? formatZodError(result.error) : result.error;
      next(new ApiError(400, "Validation failed", details));
      return;
    }

    req.validated = result.data;
    next();
  };
