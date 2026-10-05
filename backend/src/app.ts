import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { authRouter } from "./auth/auth.routes.js";
import { businessRouter } from "./businesses/business.routes.js";
import { prisma } from "./db.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", config.NODE_ENV === "production" ? 1 : false);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || config.corsOrigins.includes(origin));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/healthz", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/readyz", async (_request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: "ready" });
  } catch (error) {
    console.error("API readiness check failed:", error);
    response.status(503).json({
      error: { code: "API_NOT_READY", message: "The API database is unavailable." }
    });
  }
});

app.use("/auth", authRouter);
app.use("/businesses", businessRouter);

app.use((_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled API error:", error);
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." } });
});
