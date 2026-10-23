import { createHash, randomBytes } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { unauthorized } from "../libs/apiError.js";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export interface AccessClaims {
  sub: string;
  typ: "access";
}

export interface RefreshClaims {
  sub: string;
  typ: "refresh";
  jti: string;
}

export interface FileClaims {
  sub: string;
  typ: "file";
  fid: string;
}

export interface NoteUnlockClaims {
  sub: string;
  typ: "note";
  nid: string;
}

const sign = (payload: object, expiresIn: SignOptions["expiresIn"]) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn });

export const signAccessToken = (userId: string) =>
  sign({ sub: userId, typ: "access" }, env.JWT_EXPIRES_IN as SignOptions["expiresIn"]);

export const signRefreshToken = (userId: string, jti: string) =>
  sign({ sub: userId, typ: "refresh", jti }, env.REFRESH_EXPIRES_IN as SignOptions["expiresIn"]);

export const signFileToken = (userId: string, fileId: string) =>
  sign({ sub: userId, typ: "file", fid: fileId }, "1h");

export const signNoteUnlock = (userId: string, noteId: string) =>
  sign({ sub: userId, typ: "note", nid: noteId }, "12h");

const verify = <T>(token: string): T => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as T;
  } catch {
    throw unauthorized("Session expired");
  }
};

export const verifyAccessToken = (token: string) => {
  const claims = verify<AccessClaims>(token);
  if (claims.typ !== "access" || !claims.sub) throw unauthorized();
  return claims;
};

export const verifyRefreshToken = (token: string) => {
  const claims = verify<RefreshClaims>(token);
  if (claims.typ !== "refresh" || !claims.sub || !claims.jti) throw unauthorized();
  return claims;
};

export const verifyFileToken = (token: string) => {
  const claims = verify<FileClaims>(token);
  if (claims.typ !== "file" || !claims.fid) throw unauthorized("File link expired");
  return claims;
};

export const verifyNoteUnlock = (token: string, noteId: string, userId: string) => {
  const claims = verify<NoteUnlockClaims>(token);
  if (claims.typ !== "note" || claims.nid !== noteId || claims.sub !== userId) {
    throw unauthorized("Unlock this note again");
  }
  return claims;
};

export const refreshCookieName = "stash_refresh";

export const refreshMaxAgeMs = () => {
  const match = /^(\d+)([smhd])$/.exec(env.REFRESH_EXPIRES_IN);
  if (!match?.[1] || !match[2]) return 30 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const mult = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return amount * mult;
};
