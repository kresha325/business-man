import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/edi_test";
process.env.JWT_ACCESS_SECRET ??= "test-only-secret-with-at-least-thirty-two-characters";

const { app } = await import("./app.js");
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The test HTTP server did not bind to a network address.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

describe("API shell", () => {
  it("reports that the service is alive", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns a structured error for unknown routes", async () => {
    const response = await fetch(`${baseUrl}/missing`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found." }
    });
  });

  it("rejects malformed login data before querying the database", async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" })
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" }
    });
  });

  it("rejects untrusted browser origins on cookie-auth endpoints", async () => {
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { origin: "https://attacker.example" }
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "UNTRUSTED_ORIGIN" }
    });
  });
});
