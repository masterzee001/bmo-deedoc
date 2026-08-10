import fs from "node:fs";
import path from "node:path";
import { configureEvidenceObjectStorage } from "@pics-nigeria/object-storage";
import dotenv from "dotenv";
import { z } from "zod";

function findRepoRoot(start: string): string {
  let current = path.resolve(start);

  while (true) {
    const schemaPath = path.join(current, "packages", "database", "prisma", "schema.prisma");
    if (fs.existsSync(schemaPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}

const repoRoot = findRepoRoot(__dirname);
const appRoot = path.join(repoRoot, "apps", "worker");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(appRoot, ".env"), override: true });

const booleanString = z
  .string()
  .default("false")
  .transform((value) => ["1", "true", "yes", "on"].includes(value.trim().toLowerCase()));

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
      message: "DATABASE_URL must use PostgreSQL.",
    }),

    // BullMQ requires Redis. Unlike the API, the worker cannot run without it,
    // so this is validated as required rather than optional.
    REDIS_URL: z.string().min(1, "REDIS_URL is required to run the background worker."),

    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(4),
    /** How often durable PENDING jobs are swept into BullMQ. */
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).max(300_000).default(5_000),
    /** A job left PROCESSING beyond this age is treated as an abandoned run. */
    WORKER_STALE_PROCESSING_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
    /** Bounds each outbox replay batch so a backlog cannot monopolize the worker. */
    WORKER_OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(100),
    WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(4100),

    STORAGE_DRIVER: z.enum(["s3", "memory"]).default(process.env.NODE_ENV === "test" ? "memory" : "s3"),
    STORAGE_ENDPOINT: z.string().default(""),
    STORAGE_REGION: z.string().default(""),
    STORAGE_BUCKET: z.string().default(""),
    STORAGE_ACCESS_KEY: z.string().default(""),
    STORAGE_SECRET_KEY: z.string().default(""),
    STORAGE_FORCE_PATH_STYLE: booleanString,
  })
  .superRefine((value, context) => {
    if (value.STORAGE_DRIVER === "s3") {
      for (const key of ["STORAGE_ENDPOINT", "STORAGE_REGION", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY"] as const) {
        if (!value[key].trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3.`,
          });
        }
      }
    }

    // Derivatives are written next to authoritative originals. Allowing the
    // in-memory driver in production would silently discard them.
    if (value.NODE_ENV === "production" && value.STORAGE_DRIVER !== "s3") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STORAGE_DRIVER"],
        message: "Production evidence storage must use STORAGE_DRIVER=s3.",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid worker environment configuration: ${details}`);
}

export const env = parsed.data;

configureEvidenceObjectStorage({
  driver: env.STORAGE_DRIVER,
  endpoint: env.STORAGE_ENDPOINT,
  region: env.STORAGE_REGION,
  bucket: env.STORAGE_BUCKET,
  accessKey: env.STORAGE_ACCESS_KEY,
  secretKey: env.STORAGE_SECRET_KEY,
  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
  isTest: env.NODE_ENV === "test",
});
