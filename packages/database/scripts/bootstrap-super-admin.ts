import path from "node:path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
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

function getBootstrapConfig() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    return null;
  }

  return {
    email: normalizeEmail(email),
    password,
    name: process.env.SUPER_ADMIN_NAME?.trim() || "PICS Nigeria Super Admin",
  };
}

async function main() {
  const bootstrap = getBootstrapConfig();

  if (!bootstrap) {
    console.log("SUPER_ADMIN bootstrap skipped: SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is not configured.");
    process.exitCode = 0;
    return;
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: bootstrap.email },
    select: { id: true, role: true },
  });

  if (existingByEmail) {
    if (existingByEmail.role !== UserRole.SUPER_ADMIN) {
      console.error("SUPER_ADMIN bootstrap failed: configured email belongs to a non-super-admin user.");
      process.exitCode = 1;
      return;
    }

    console.log("SUPER_ADMIN exists.");
    process.exitCode = 0;
    return;
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN },
    select: { id: true, email: true },
  });

  if (existingSuperAdmin) {
    console.error("SUPER_ADMIN bootstrap failed: a different SUPER_ADMIN already exists.");
    process.exitCode = 1;
    return;
  }

  await prisma.user.create({
    data: {
      name: bootstrap.name,
      email: bootstrap.email,
      passwordHash: await bcrypt.hash(bootstrap.password, 10),
      role: UserRole.SUPER_ADMIN,
    },
  });

  console.log("SUPER_ADMIN created.");
}

main()
  .catch((error) => {
    console.error("SUPER_ADMIN bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
