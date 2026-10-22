import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export const signAccessToken = (userId: string) => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    subject: userId,
  };

  return jwt.sign({}, env.JWT_SECRET, options);
};

export const verifyAccessToken = (token: string) => {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (typeof decoded === "string" || !decoded.sub) {
    throw new Error("Invalid token payload");
  }

  return { userId: decoded.sub };
};
