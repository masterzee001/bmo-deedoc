import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { USER_ROLES, type AuthUserProfile } from "@pics-nigeria/shared";
import { env } from "../env";

type AuthTokenPayload = {
  sub: string;
  role: AuthUserProfile["role"];
  sessionNonce?: string;
};

export function signAccessToken(user: AuthUserProfile, options?: { sessionNonce?: string }): string {
  return jwt.sign({ sub: user.id, role: user.role, sessionNonce: options?.sessionNonce }, env.JWT_SECRET, {
    algorithm: "HS256",
    audience: env.JWT_AUDIENCE,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER,
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    audience: env.JWT_AUDIENCE,
    issuer: env.JWT_ISSUER,
  });

  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    typeof payload.role !== "string" ||
    !USER_ROLES.includes(payload.role as AuthUserProfile["role"])
  ) {
    throw new Error("Invalid access token payload.");
  }

  return {
    sub: payload.sub,
    role: payload.role as AuthUserProfile["role"],
    sessionNonce: typeof payload.sessionNonce === "string" ? payload.sessionNonce : undefined,
  };
}
