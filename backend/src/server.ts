import { app } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const server = app.listen(config.PORT, () => {
  console.info(`EDI API listening on port ${config.PORT}`);
});

async function shutdown(signal: string) {
  console.info(`${signal} received; shutting down EDI API.`);
  server.close(async (error) => {
    if (error) {
      console.error("HTTP server shutdown failed:", error);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
