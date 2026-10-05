import { Router } from "express";
import { createBusinessSchema, createLocationSchema } from "@edi/validation";
import { requireActiveAccount, requireAuthentication } from "../auth/auth.middleware.js";
import { listUserBusinesses, createBusinessForOwner, createLocationForBusiness, isUniqueConstraintError } from "./business.service.js";
import {
  requireBusinessContext,
  requireBusinessPermission,
  type TenantRequest
} from "./business.middleware.js";

export const businessRouter = Router();

businessRouter.get("/", requireAuthentication, async (request: TenantRequest, response, next) => {
  const userId = request.userId;
  if (!userId) {
    response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
    return;
  }
  try {
    response.json({ businesses: await listUserBusinesses(userId) });
  } catch (error) {
    next(error);
  }
});

businessRouter.post("/", requireAuthentication, requireActiveAccount, async (request: TenantRequest, response, next) => {
  const userId = request.userId;
  if (!userId) {
    response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
    return;
  }
  const input = createBusinessSchema.safeParse(request.body);
  if (!input.success) {
    response.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Check the business details and enabled modules." }
    });
    return;
  }

  try {
    const business = await createBusinessForOwner(userId, input.data);
    response.status(201).json({ business });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({
        error: { code: "BUSINESS_SLUG_TAKEN", message: "That business URL is already in use." }
      });
      return;
    }
    next(error);
  }
});

businessRouter.get("/current", requireAuthentication, requireBusinessContext, (request: TenantRequest, response) => {
  const context = request.businessContext;
  if (!context) {
    response.status(400).json({
      error: { code: "BUSINESS_CONTEXT_REQUIRED", message: "Select a business before continuing." }
    });
    return;
  }
  response.json({ business: context });
});

businessRouter.post(
  "/current/locations",
  requireAuthentication,
  requireBusinessContext,
  requireBusinessPermission("business.locations.manage"),
  async (request: TenantRequest, response, next) => {
    const input = createLocationSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Check the location details." }
      });
      return;
    }
    const businessId = request.businessContext?.businessId;
    if (!businessId) {
      response.status(400).json({
        error: { code: "BUSINESS_CONTEXT_REQUIRED", message: "Select a business before continuing." }
      });
      return;
    }

    try {
      const location = await createLocationForBusiness(businessId, input.data);
      response.status(201).json({ location });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        response.status(409).json({
          error: { code: "LOCATION_SLUG_TAKEN", message: "That location URL is already in use in this business." }
        });
        return;
      }
      next(error);
    }
  }
);
