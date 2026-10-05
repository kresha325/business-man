import { describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/edi_test";
process.env.JWT_ACCESS_SECRET ??= "test-only-secret-with-at-least-thirty-two-characters";

const tokenModule = await import("./tokens.js");

describe("authentication tokens", () => {
  it("creates unique opaque refresh tokens and stores only deterministic hashes", () => {
    const first = tokenModule.createRefreshToken();
    const second = tokenModule.createRefreshToken();

    expect(first).not.toBe(second);
    expect(tokenModule.hashRefreshToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenModule.hashRefreshToken(first)).toBe(tokenModule.hashRefreshToken(first));
    expect(tokenModule.hashRefreshToken(first)).not.toBe(first);
  });

  it("signs access tokens with the expected subject", () => {
    const token = tokenModule.createAccessToken("user-123");
    expect(tokenModule.verifyAccessToken(token)).toEqual({ sub: "user-123" });
  });

  it("rejects invalid access tokens", () => {
    expect(() => tokenModule.verifyAccessToken("invalid.token.value")).toThrow();
  });
});
