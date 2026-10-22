import type { NextFunction, Request, Response } from "express";
import { unauthorized } from "../libs/apiError.js";
import { User } from "../models/user.model.js";
import { verifyAccessToken } from "../utils/tokens.js";

export const requireUser = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) throw unauthorized();
    const claims = verifyAccessToken(header.slice(7));
    const user = await User.findById(claims.sub).select("name email");
    if (!user) throw unauthorized("Account no longer exists");
    req.userId = user._id.toString();
    req.userEmail = user.email;
    req.userName = user.name;
    next();
  } catch (error) {
    next(error);
  }
};
