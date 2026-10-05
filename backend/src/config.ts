import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:5174,http://localhost:5175"),
  REFRESH_COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("lax")
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error("Invalid environment configuration:", parsedEnvironment.error.flatten().fieldErrors);
  throw new Error("The API cannot start with invalid environment configuration.");
}

export const config = {
  ...parsedEnvironment.data,
  corsOrigins: parsedEnvironment.data.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  refreshCookieSecure: parsedEnvironment.data.NODE_ENV === "production" ||
    parsedEnvironment.data.REFRESH_COOKIE_SAME_SITE === "none"
};

if (config.REFRESH_COOKIE_SAME_SITE === "none" && !config.refreshCookieSecure) {
  throw new Error("SameSite=None refresh cookies require secure transport.");
}
