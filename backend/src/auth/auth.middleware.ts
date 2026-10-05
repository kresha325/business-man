import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./tokens.js";
import { requireBusinessPermission } from "../businesses/business.middleware.js";
import { prisma } from "../db.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function requireAuthentication(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const authorization = request.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  const token = match?.[1];

  if (!token) {
    response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
    return;
  }

  try {
    request.userId = verifyAccessToken(token).sub;
    next();
  } catch {
    response.status(401).json({ error: { code: "INVALID_TOKEN", message: "The access token is invalid or expired." } });
  }
}

export async function requireActiveAccount(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
) {
  if (!request.userId) {
    response.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Authentication is required." }
    });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: request.userId, status: "ACTIVE" },
      select: { id: true }
    });
    if (!user) {
      response.status(401).json({
        error: { code: "ACCOUNT_DISABLED", message: "This account is not active." }
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export const requirePermission = requireBusinessPermission;
