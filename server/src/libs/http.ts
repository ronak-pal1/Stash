import type { Response } from "express";

export interface PageMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export const sendData = <T>(res: Response, data: T, status = 200, meta: PageMeta | null = null) => {
  res.status(status).json({ data, error: null, meta });
};

export const sendError = (res: Response, status: number, message: string, details?: unknown) => {
  res.status(status).json({
    data: null,
    error: { message, details: details ?? null },
    meta: null,
  });
};
