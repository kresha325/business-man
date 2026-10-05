import { Router } from "express";
import rateLimit from "express-rate-limit";
import { loginSchema } from "@edi/validation";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { authenticate, revokeRefreshToken, rotateRefreshToken } from "./auth.service.js";
import { listUserBusinesses } from "../businesses/business.service.js";
import { requireAuthentication, type AuthenticatedRequest } from "./auth.middleware.js";
import type { NextFunction, Request, Response } from "express";

export const authRouter = Router();
const refreshCookieName = "edi_refresh";
const refreshCookieOptions = {
  httpOnly: true,
  secure: config.refreshCookieSecure,
  sameSite: config.REFRESH_COOKIE_SAME_SITE,
  path: "/auth"
} as const;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many sign-in attempts. Try again later." } }
});

function requireTrustedOrigin(request: Request, response: Response, next: NextFunction) {
  const origin = request.get("origin");
  if (origin && !config.corsOrigins.includes(origin)) {
    response.status(403).json({ error: { code: "UNTRUSTED_ORIGIN", message: "This origin is not allowed." } });
    return;
  }
  next();
}

authRouter.post("/login", loginLimiter, requireTrustedOrigin, async (request, response, next) => {
  const input = loginSchema.safeParse(request.body);
  if (!input.success) {
    response.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Check the supplied email and password." }
    });
    return;
  }

  try {
    const result = await authenticate(input.data.email, input.data.password, request);
    if (!result) {
      response.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } });
      return;
    }

    response.cookie(refreshCookieName, result.refreshToken, {
      ...refreshCookieOptions,
      maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
    });
    response.json({
      accessToken: result.accessToken,
      expiresInSeconds: result.expiresInSeconds,
      user: result.user,
      businesses: result.businesses
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", loginLimiter, requireTrustedOrigin, async (request, response, next) => {
  const token = request.cookies?.[refreshCookieName];
  if (typeof token !== "string") {
    response.status(401).json({ error: { code: "INVALID_SESSION", message: "A valid refresh session is required." } });
    return;
  }

  try {
    const result = await rotateRefreshToken(token, request);
    if (!result) {
      response.clearCookie(refreshCookieName, refreshCookieOptions);
      response.status(401).json({ error: { code: "INVALID_SESSION", message: "The refresh session is invalid or expired." } });
      return;
    }

    response.cookie(refreshCookieName, result.refreshToken, {
      ...refreshCookieOptions,
      maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
    });
    response.json({
      accessToken: result.accessToken,
      expiresInSeconds: result.expiresInSeconds,
      user: result.user,
      businesses: result.businesses
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", requireTrustedOrigin, async (request, response, next) => {
  const token = request.cookies?.[refreshCookieName];
  try {
    if (typeof token === "string") {
      await revokeRefreshToken(token);
    }
    response.clearCookie(refreshCookieName, refreshCookieOptions);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuthentication, async (request: AuthenticatedRequest, response, next) => {
  const userId = request.userId;
  if (!userId) {
    response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, status: "ACTIVE" },
      select: { id: true, email: true, displayName: true }
    });

    if (!user) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "The user is not active." } });
      return;
    }

    response.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      businesses: await listUserBusinesses(user.id)
    });
  } catch (error) {
    next(error);
  }
});
