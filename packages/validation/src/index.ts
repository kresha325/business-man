import { z } from "zod";

export const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128)
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const businessTypes = [
  "RETAIL",
  "WHOLESALE",
  "RESTAURANT",
  "CAFE",
  "PIZZERIA",
  "ELECTRICAL",
  "CONSTRUCTION",
  "FURNITURE",
  "SUPERMARKET",
  "PHARMACY",
  "SERVICES",
  "OTHER"
] as const;

export const businessModules = [
  "products",
  "categories",
  "brands",
  "customers",
  "suppliers",
  "sales",
  "purchases",
  "inventory",
  "warehouse",
  "expenses",
  "payments",
  "pos",
  "ecommerce",
  "installers",
  "reports",
  "tables",
  "kitchen",
  "delivery",
  "menu",
  "appointments",
  "service-orders",
  "custom-orders"
] as const;

const businessBaseSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(63),
  type: z.enum(businessTypes),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().min(1).max(120),
  address: z.string().trim().max(240).optional(),
  phone: z.string().trim().max(40).optional(),
  email: emailSchema.optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("EUR"),
  vatRate: z.number().min(0).max(100).default(0)
}).strict();

export const createBusinessSchema = businessBaseSchema.extend({
  enabledModules: z.array(z.enum(businessModules))
    .max(businessModules.length)
    .refine((modules) => new Set(modules).size === modules.length, "Modules must not be duplicated.")
    .optional()
}).strict();

export const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(63),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().min(1).max(120),
  address: z.string().trim().max(240).optional(),
  phone: z.string().trim().max(40).optional()
}).strict();

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
