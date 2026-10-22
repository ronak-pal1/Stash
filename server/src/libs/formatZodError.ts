import type { ZodError } from "zod";

export const formatZodError = (error: ZodError) =>
  error.issues.map((issue) => {
    const segments = issue.path.map(String);
    const location = segments[0];
    const field =
      location === "body" || location === "query" || location === "params"
        ? segments.slice(1).join(".")
        : segments.join(".");

    return {
      path: field || location || "request",
      message: issue.message,
    };
  });
