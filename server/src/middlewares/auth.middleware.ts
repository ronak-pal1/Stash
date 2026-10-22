import type { Request } from "express";
import mongoose from "mongoose";
import { ApiError } from "../libs/apiError.js";
import { asyncHandler } from "../libs/asyncHandler.js";
import { verifyAccessToken } from "../libs/jwt.js";
import { User } from "../models/user.model.js";

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  let userId: string;
  try {
    userId = verifyAccessToken(token).userId;
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }

  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(401, "Invalid or expired token");
  }

  const user = await User.exists({ _id: userId });
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }

  req.user = { id: userId };
  next();
});

export const getRequestUserId = (req: Request) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  return req.user.id;
};
