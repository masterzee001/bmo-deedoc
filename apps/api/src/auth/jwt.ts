import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { AuthUserProfile } from "@pics-nigeria/shared";
import { env } from "../env";

type AuthTokenPayload = {
  sub: string;
  role: AuthUserProfile["role"];
  sessionNonce?: string;
};

export function signAccessToken(user: AuthUserProfile, options?: { sessionNonce?: string }): string {
  return jwt.sign({ sub: user.id, role: user.role, sessionNonce: options?.sessionNonce }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
}
