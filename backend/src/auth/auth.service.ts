import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { createAccessToken, createRefreshToken, hashRefreshToken } from "./tokens.js";
import { listUserBusinesses } from "../businesses/business.service.js";

const refreshDurationMs = config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const dummyPasswordHash = bcrypt.hashSync(randomBytes(32).toString("hex"), 12);

function getClientMetadata(request: Request) {
  return {
    ipAddress: request.ip,
    userAgent: request.get("user-agent")?.slice(0, 512)
  };
}

async function getUserAuthData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId, status: "ACTIVE" },
    select: {
      id: true,
      email: true,
      displayName: true
    }
  });
}

function toPublicUser(user: NonNullable<Awaited<ReturnType<typeof getUserAuthData>>>) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName
  };
}

export async function authenticate(email: string, password: string, request: Request) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, status: true }
  });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? dummyPasswordHash);

  if (!user || user.status !== "ACTIVE" || !passwordMatches) {
    return null;
  }

  const refreshToken = createRefreshToken();
  await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshDurationMs),
      ...getClientMetadata(request)
    }
  });

  const publicUser = await getUserAuthData(user.id);
  if (!publicUser) {
    throw new Error("Authenticated user could not be loaded.");
  }
  const businesses = await listUserBusinesses(user.id);

  return {
    accessToken: createAccessToken(user.id),
    expiresInSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    user: { ...toPublicUser(publicUser), businesses },
    businesses
  };
}

export async function rotateRefreshToken(token: string, request: Request) {
  const now = new Date();
  const tokenHash = hashRefreshToken(token);
  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true }
  });

  if (!session || session.revokedAt || session.expiresAt <= now) {
    return null;
  }

  const refreshToken = createRefreshToken();
  const created = await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.authSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      data: { revokedAt: now }
    });

    if (claimed.count !== 1) {
      return false;
    }

    await transaction.authSession.create({
      data: {
        userId: session.userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshDurationMs),
        ...getClientMetadata(request)
      }
    });
    return true;
  });

  if (!created) {
    return null;
  }

  const user = await getUserAuthData(session.userId);
  if (!user) {
    await prisma.authSession.updateMany({
      where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return null;
  }
  const businesses = await listUserBusinesses(session.userId);

  return {
    accessToken: createAccessToken(session.userId),
    expiresInSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    user: { ...toPublicUser(user), businesses },
    businesses
  };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { tokenHash: hashRefreshToken(token), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
