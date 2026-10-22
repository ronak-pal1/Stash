import mongoose from "mongoose";
import { badRequest } from "../libs/apiError.js";

export const asObjectId = (value: string, label = "id") => {
  if (!mongoose.isValidObjectId(value)) throw badRequest(`Invalid ${label}`);
  return new mongoose.Types.ObjectId(value);
};

export const encodeCursor = (updatedAt: Date, id: string) =>
  Buffer.from(`${updatedAt.toISOString()}|${id}`).toString("base64url");

export const decodeCursor = (cursor: string) => {
  const raw = Buffer.from(cursor, "base64url").toString("utf8");
  const [iso, id] = raw.split("|");
  if (!iso || !id || Number.isNaN(Date.parse(iso)) || !mongoose.isValidObjectId(id)) {
    throw badRequest("Invalid cursor");
  }
  return { updatedAt: new Date(iso), id };
};
