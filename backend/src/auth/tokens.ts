import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface AccessTokenClaims {
  sub: string;
}

export function createAccessToken(userId: string): string {
  return jwt.sign({}, config.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
    issuer: "edi-api",
    audience: "edi-clients"
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const claims = jwt.verify(token, config.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: "edi-api",
    audience: "edi-clients"
  });

  if (typeof claims === "string" || typeof claims.sub !== "string") {
    throw new Error("Invalid access token claims.");
  }
  return { sub: claims.sub };
}

export function createRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
