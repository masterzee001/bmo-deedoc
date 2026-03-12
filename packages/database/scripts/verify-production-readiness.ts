import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";
import { normalizeEmail } from "@pics-nigeria/shared";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl?.startsWith("file:")) {
  const relativePath = databaseUrl.slice("file:".length);
  if (!path.isAbsolute(relativePath)) {
    process.env.DATABASE_URL = `file:${path.resolve(__dirname, "../prisma", relativePath)}`;
  }
}

const prisma = new PrismaClient();

async function main() {
  const configuredEmail = process.env.SUPER_ADMIN_EMAIL?.trim()
    ? normalizeEmail(process.env.SUPER_ADMIN_EMAIL)
    : null;
  const hasBootstrapPassword = Boolean(process.env.SUPER_ADMIN_PASSWORD);

  await prisma.$queryRaw`SELECT 1`;

  const superAdmin = configuredEmail
    ? await prisma.user.findUnique({
        where: { email: configuredEmail },
        select: { id: true, role: true, isActive: true },
      })
    : await prisma.user.findFirst({
        where: { role: UserRole.SUPER_ADMIN },
        select: { id: true, email: true, role: true, isActive: true },
      });

  console.log("Production readiness check");
  console.log("database_connectivity=ok");
  console.log(`super_admin_email_configured=${configuredEmail ? "yes" : "no"}`);
  console.log(`super_admin_password_configured=${hasBootstrapPassword ? "yes" : "no"}`);
  console.log(`super_admin_exists=${superAdmin ? "yes" : "no"}`);
  console.log(`super_admin_active=${superAdmin?.isActive ? "yes" : "no"}`);

  if (configuredEmail && hasBootstrapPassword && (!superAdmin || superAdmin.role !== UserRole.SUPER_ADMIN)) {
    console.error("Configured SUPER_ADMIN credentials are present, but the SUPER_ADMIN account does not exist.");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Production readiness check failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
