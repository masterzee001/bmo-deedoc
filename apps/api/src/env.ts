import fs from "node:fs";
import path from "node:path";
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
const appRoot = path.join(repoRoot, "apps", "api");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(appRoot, ".env"), override: true });

const durationPattern = /^\d+(ms|s|m|h|d|w|y)$/;
const sizePattern = /^\d+(b|kb|mb)$/i;
const booleanString = z
  .string()
  .default("false")
  .transform((value) => ["1", "true", "yes", "on"].includes(value.trim().toLowerCase()));
const insecureJwtSecrets = new Set([
  "change-me",
  "changeme",
  "development-secret",
  "secret",
  "your-secret-here",
]);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
      message: "DATABASE_URL must use PostgreSQL.",
    }),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must contain at least 16 characters."),
    JWT_EXPIRES_IN: z.string().regex(durationPattern, "JWT_EXPIRES_IN must be a duration such as 15m or 7d.").default("7d"),
    JWT_ISSUER: z.string().min(1).default("ogun-election-operations-api"),
    JWT_AUDIENCE: z.string().min(1).default("ogun-election-operations-web"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    API_JSON_BODY_LIMIT: z.string().regex(sizePattern, "API_JSON_BODY_LIMIT must be a size such as 1mb.").default("1mb"),
    CORS_ALLOWED_ORIGINS: z.string().default(""),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
    REGISTRATION_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
    STORAGE_DRIVER: z.enum(["s3", "memory"]).default(process.env.NODE_ENV === "test" ? "memory" : "s3"),
    STORAGE_ENDPOINT: z.string().default(""),
    STORAGE_REGION: z.string().default("auto"),
    STORAGE_BUCKET: z.string().default(""),
    STORAGE_ACCESS_KEY: z.string().default(""),
    STORAGE_SECRET_KEY: z.string().default(""),
    STORAGE_FORCE_PATH_STYLE: z
      .string()
      .default("false")
      .transform((value) => value.toLowerCase() === "true"),
    REDIS_URL: z.string().url().or(z.literal("")).default(""),
    REALTIME_ALLOWED_ORIGINS: z.string().default(""),
    REALTIME_PATH: z.string().trim().min(1).default("/socket.io"),
    REALTIME_CONNECTION_STATE_RECOVERY_MS: z.coerce.number().int().min(0).default(2 * 60 * 1000),
    REALTIME_PRESENCE_TTL_SECONDS: z.coerce.number().int().min(10).max(3600).default(90),
    REALTIME_REDIS_REQUIRED: booleanString,
    WEBRTC_STUN_URLS: z.string().default("stun:stun.l.google.com:19302"),
    TURN_URL: z.string().default(""),
    TURN_USERNAME: z.string().default(""),
    TURN_CREDENTIAL: z.string().default(""),
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

    if (value.NODE_ENV === "production" && value.STORAGE_DRIVER !== "s3") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STORAGE_DRIVER"],
        message: "Production evidence storage must use private S3-compatible object storage.",
      });
    }

    if (value.NODE_ENV !== "production") {
      return;
    }

    if (value.JWT_SECRET.length < 32 || insecureJwtSecrets.has(value.JWT_SECRET.toLowerCase())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "Production JWT_SECRET must be a non-default secret of at least 32 characters.",
      });
    }

    if (!value.CORS_ALLOWED_ORIGINS.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ALLOWED_ORIGINS"],
        message: "Production CORS_ALLOWED_ORIGINS must contain at least one explicit origin.",
      });
    }

    if (!value.TURN_URL.trim() || !value.TURN_USERNAME.trim() || !value.TURN_CREDENTIAL.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TURN_URL"],
        message: "Production WebRTC voice requires TURN_URL, TURN_USERNAME, and TURN_CREDENTIAL.",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid API environment configuration: ${details}`);
}

export const env = {
  ...parsed.data,
  CORS_ALLOWED_ORIGINS: parsed.data.CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  REALTIME_ALLOWED_ORIGINS: parsed.data.REALTIME_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  WEBRTC_STUN_URLS: parsed.data.WEBRTC_STUN_URLS.split(",")
    .map((url) => url.trim())
    .filter(Boolean),
};
