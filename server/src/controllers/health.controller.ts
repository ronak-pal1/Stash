import mongoose from "mongoose";
import { asyncHandler } from "../libs/asyncHandler.js";
import { sendSuccess } from "../libs/apiResponse.js";

export const getHealth = asyncHandler(async (_req, res) => {
  sendSuccess(res, 200, "Stash API is running", {
    status: "ok",
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});
