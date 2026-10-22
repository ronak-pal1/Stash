import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { authRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { loginSchema, registerSchema } from "../validators/auth.validator.js";

export const authRouter = Router();

authRouter.post("/register", authRateLimit, validate(registerSchema), authController.register);
authRouter.post("/login", authRateLimit, validate(loginSchema), authController.login);
authRouter.get("/me", requireAuth, authController.me);
