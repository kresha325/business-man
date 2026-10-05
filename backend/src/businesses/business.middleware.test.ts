import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/edi_test";
process.env.JWT_ACCESS_SECRET ??= "test-only-secret-with-at-least-thirty-two-characters";

const { createAccessToken } = await import("../auth/tokens.js");
const { requireAuthentication } = await import("../auth/auth.middleware.js");
const { createBusinessContextMiddleware, requireBusinessFeature, requireBusinessPermission } =
  await import("./business.middleware.js");

const memberships = new Map([
  ["user-a:business-a", {
    business: {
      id: "business-a",
      name: "Business A",
      slug: "business-a",
      type: "ELECTRICAL" as const,
      features: [{ key: "products" }]
    },
    role: "ADMIN",
    permissions: ["products.view"]
  }],
  ["user-b:business-b", {
    business: {
      id: "business-b",
      name: "Business B",
      slug: "business-b",
      type: "PIZZERIA" as const,
      features: [{ key: "menu" }]
    },
    role: "CASHIER",
    permissions: ["menu.view"]
  }],
  ["user-c:business-c", {
    business: {
      id: "business-c",
      name: "Business C",
      slug: "business-c",
      type: "RETAIL" as const,
      features: []
    },
    role: "MANAGER",
    permissions: ["products.view"]
  }]
]);

const requireTestBusiness = createBusinessContextMiddleware(async (userId, businessId) =>
  memberships.get(`${userId}:${businessId}`) ?? null
);
const tenantApp = express();
tenantApp.use(express.json());
const sendTenantContext: express.RequestHandler = (request, response) => {
  const context = (request as express.Request & {
    businessContext: { businessId: string; role: string; enabledModules: string[] };
  }).businessContext;
  response.json({
    businessId: context.businessId,
    role: context.role,
    enabledModules: context.enabledModules
  });
};
const tenantHandlers = [
  requireAuthentication,
  requireTestBusiness,
  requireBusinessPermission("products.view"),
  requireBusinessFeature("products"),
  sendTenantContext
];
tenantApp.get("/tenant/resource", ...tenantHandlers);
tenantApp.post("/tenant/resource", ...tenantHandlers);

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = await new Promise((resolve) => {
    const listeningServer = tenantApp.listen(0, () => resolve(listeningServer));
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

describe("business context authorization", () => {
  it("allows an active member to access only the selected business", async () => {
    const response = await fetch(`${baseUrl}/tenant/resource`, {
      headers: {
        authorization: `Bearer ${createAccessToken("user-a")}`,
        "x-business-id": "business-a"
      }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      businessId: "business-a",
      role: "ADMIN",
      enabledModules: ["products"]
    });
  });

  it("denies a member attempting to select another business", async () => {
    const response = await fetch(`${baseUrl}/tenant/resource`, {
      headers: {
        authorization: `Bearer ${createAccessToken("user-a")}`,
        "x-business-id": "business-b"
      }
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "BUSINESS_ACCESS_DENIED" }
    });
  });

  it("ignores a forged businessId in the request body and requires the verified context", async () => {
    const withoutContext = await fetch(`${baseUrl}/tenant/resource?businessId=business-b`, {
      headers: { authorization: `Bearer ${createAccessToken("user-a")}` }
    });
    expect(withoutContext.status).toBe(400);

    const selectedBusiness = await fetch(`${baseUrl}/tenant/resource`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${createAccessToken("user-a")}`,
        "x-business-id": "business-a",
        "content-type": "application/json"
      },
      body: JSON.stringify({ businessId: "business-b" })
    });
    expect(selectedBusiness.status).toBe(200);
    expect(await selectedBusiness.json()).toMatchObject({ businessId: "business-a" });
  });

  it("keeps role permissions and enabled modules scoped to each membership", async () => {
    const response = await fetch(`${baseUrl}/tenant/resource`, {
      headers: {
        authorization: `Bearer ${createAccessToken("user-b")}`,
        "x-business-id": "business-b"
      }
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "FORBIDDEN" }
    });
  });

  it("denies a permission when the business module is disabled", async () => {
    const response = await fetch(`${baseUrl}/tenant/resource`, {
      headers: {
        authorization: `Bearer ${createAccessToken("user-c")}`,
        "x-business-id": "business-c"
      }
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "FEATURE_NOT_ENABLED" }
    });
  });
});
