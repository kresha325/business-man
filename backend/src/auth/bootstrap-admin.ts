import "dotenv/config";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { emailSchema } from "@edi/validation";
import { prisma } from "../db.js";
import { ensureInitialEdiBusiness } from "../businesses/business.service.js";

const bootstrapSchema = z.object({
  EDI_ADMIN_EMAIL: emailSchema,
  EDI_ADMIN_PASSWORD: z.string().min(12).max(128),
  EDI_ADMIN_NAME: z.string().trim().min(1).max(120)
});

const input = bootstrapSchema.safeParse(process.env);
if (!input.success) {
  console.error("Set EDI_ADMIN_EMAIL, EDI_ADMIN_PASSWORD (at least 12 characters), and EDI_ADMIN_NAME.");
  process.exitCode = 1;
} else {
  try {
    const passwordHash = await bcrypt.hash(input.data.EDI_ADMIN_PASSWORD, 12);
    await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.upsert({
        where: { email: input.data.EDI_ADMIN_EMAIL },
        create: {
          email: input.data.EDI_ADMIN_EMAIL,
          displayName: input.data.EDI_ADMIN_NAME,
          passwordHash
        },
        update: {
          displayName: input.data.EDI_ADMIN_NAME,
          status: "ACTIVE"
        }
      });

      await ensureInitialEdiBusiness(transaction, user.id);
    });
    console.info(`Administrator and EDI Electro tenant configured for ${input.data.EDI_ADMIN_EMAIL}.`);
  } catch (error) {
    console.error("Administrator bootstrap failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
