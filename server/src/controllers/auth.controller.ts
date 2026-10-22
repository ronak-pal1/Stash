import { asyncHandler } from "../libs/asyncHandler.js";
import { sendSuccess } from "../libs/apiResponse.js";
import { getRequestUserId } from "../middlewares/auth.middleware.js";
import * as authService from "../services/auth.service.js";
import type { LoginInput, RegisterInput } from "../validators/auth.validator.js";

export const register = asyncHandler(async (req, res) => {
  const { body } = req.validated as RegisterInput;
  const session = await authService.registerUser(body);
  sendSuccess(res, 201, "Account created", session);
});

export const login = asyncHandler(async (req, res) => {
  const { body } = req.validated as LoginInput;
  const session = await authService.loginUser(body);
  sendSuccess(res, 200, "Logged in", session);
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(getRequestUserId(req));
  sendSuccess(res, 200, "Current user", user);
});
