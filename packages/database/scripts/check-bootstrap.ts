import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl?.startsWith("file:")) {
  const relativePath = databaseUrl.slice("file:".length);
  if (!path.isAbsolute(relativePath)) {
    process.env.DATABASE_URL = `file:${path.resolve(__dirname, "../prisma", relativePath)}`;
  }
}

const prisma = new PrismaClient();

async function main() {
  const superAdmin = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN },
    select: { id: true, email: true },
  });

  console.log("Bootstrap check");
  console.log(`super_admin_exists=${superAdmin ? "yes" : "no"}`);
  console.log(`super_admin_email_configured=${process.env.SUPER_ADMIN_EMAIL ? "yes" : "no"}`);
  console.log(`super_admin_password_configured=${process.env.SUPER_ADMIN_PASSWORD ? "yes" : "no"}`);
  console.log(`jwt_secret_configured=${process.env.JWT_SECRET ? "yes" : "no"}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
