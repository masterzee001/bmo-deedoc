import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { env } from "./env";
import adminRoutes from "./routes/admin";
import agentRoutes from "./routes/agent";
import authRoutes from "./routes/auth";
import candidateRoutes from "./routes/candidate";
import mediaRoutes from "./routes/media";
import notificationRoutes from "./routes/notifications";
import voterRoutes from "./routes/voter";

type JsonParseError = Error & {
  status?: number;
  type?: string;
};

export function createApp() {
  const app = express();
  const allowedOrigins = new Set(
    env.CORS_ALLOWED_ORIGINS.length > 0
      ? env.CORS_ALLOWED_ORIGINS
      : process.env.NODE_ENV === "production"
        ? []
        : ["http://localhost:3000", "http://127.0.0.1:3000"],
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("CORS origin not allowed."));
      },
    }),
  );
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use("/voter", voterRoutes);
  app.use("/admin", adminRoutes);
  app.use("/agent", agentRoutes);
  app.use("/candidate", candidateRoutes);
  app.use("/notifications", notificationRoutes);
  app.use("/media", mediaRoutes);

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const jsonParseError = error as JsonParseError;

    if (jsonParseError.type === "entity.parse.failed" || jsonParseError.status === 400) {
      response.status(400).json({ message: "Invalid JSON payload." });
      return;
    }

    console.error(error);
    response.status(500).json({ message: "Internal server error." });
  });

  return app;
}
