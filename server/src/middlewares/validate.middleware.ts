import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { badRequest } from "../libs/apiError.js";

export const validate =
  <T>(schema: ZodType<T>, source: "body" | "query" | "params" = "body") =>
  (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || source,
        message: issue.message,
      }));
      next(badRequest("Validation failed", details));
      return;
    }
    if (source === "body") {
      req.body = parsed.data;
    } else if (source === "query") {
      const query = req.query as Record<string, unknown>;
      for (const key of Object.keys(query)) delete query[key];
      Object.assign(query, parsed.data);
    } else {
      req.params = parsed.data as Request["params"];
    }
    next();
  };
