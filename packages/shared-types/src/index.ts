export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "CASHIER"
  | "WAREHOUSE"
  | "SALES";

export type BusinessType =
  | "RETAIL"
  | "WHOLESALE"
  | "RESTAURANT"
  | "CAFE"
  | "PIZZERIA"
  | "ELECTRICAL"
  | "CONSTRUCTION"
  | "FURNITURE"
  | "SUPERMARKET"
  | "PHARMACY"
  | "SERVICES"
  | "OTHER";

export interface BusinessSummary {
  id: string;
  name: string;
  slug: string;
  type: BusinessType;
  role: string;
  enabledModules: string[];
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  businesses: BusinessSummary[];
}

export interface BusinessContext {
  businessId: string;
  name: string;
  slug: string;
  type: BusinessType;
  role: string;
  permissions: string[];
  enabledModules: string[];
}

export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: AuthenticatedUser;
  businesses: BusinessSummary[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
