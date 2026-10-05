import type { NextFunction, Request, Response } from "express";
import type { BusinessType } from "@edi/shared-types";
import { findUserBusinessContext } from "./business.service.js";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";

export interface TenantBusinessContext {
  businessId: string;
  name: string;
  slug: string;
  type: BusinessType;
  role: string;
  permissions: string[];
  enabledModules: string[];
}

export type BusinessContextResolver = (
  userId: string,
  businessId: string
) => Promise<{
  business: { id: string; name: string; slug: string; type: BusinessType; features: Array<{ key: string }> };
  role: string;
  permissions: string[];
} | null>;

export interface TenantRequest extends AuthenticatedRequest {
  businessContext?: TenantBusinessContext;
}

export function createBusinessContextMiddleware(resolver: BusinessContextResolver) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const tenantRequest = request as TenantRequest;
    const businessId = request.get("x-business-id");
    if (!tenantRequest.userId) {
      response.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication is required." }
      });
      return;
    }
    if (!businessId || businessId.length > 128) {
      response.status(400).json({
        error: { code: "BUSINESS_CONTEXT_REQUIRED", message: "Select a business using X-Business-Id." }
      });
      return;
    }

    try {
      const membership = await resolver(tenantRequest.userId, businessId);
      if (!membership) {
        response.status(403).json({
          error: { code: "BUSINESS_ACCESS_DENIED", message: "You are not an active member of this business." }
        });
        return;
      }

      tenantRequest.businessContext = {
        businessId: membership.business.id,
        name: membership.business.name,
        slug: membership.business.slug,
        type: membership.business.type,
        role: membership.role,
        permissions: membership.permissions,
        enabledModules: membership.business.features.map(({ key }) => key)
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireBusinessContext = createBusinessContextMiddleware(findUserBusinessContext);

export function requireBusinessPermission(permission: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const context = (request as TenantRequest).businessContext;
    if (!context) {
      response.status(400).json({
        error: { code: "BUSINESS_CONTEXT_REQUIRED", message: "Select a business before continuing." }
      });
      return;
    }
    if (!context.permissions.includes(permission)) {
      response.status(403).json({
        error: { code: "FORBIDDEN", message: "You do not have permission to do this in the selected business." }
      });
      return;
    }
    next();
  };
}

export function requireBusinessFeature(feature: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const context = (request as TenantRequest).businessContext;
    if (!context) {
      response.status(400).json({
        error: { code: "BUSINESS_CONTEXT_REQUIRED", message: "Select a business before continuing." }
      });
      return;
    }
    if (!context.enabledModules.includes(feature)) {
      response.status(403).json({
        error: { code: "FEATURE_NOT_ENABLED", message: "This module is not enabled for the selected business." }
      });
      return;
    }
    next();
  };
}
