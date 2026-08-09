import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/ogun-migrations",
    seed: "tsx prisma/seed.ts",
  },
});
