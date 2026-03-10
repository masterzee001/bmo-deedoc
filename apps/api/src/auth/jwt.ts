import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { AuthUserProfile } from "@pics-nigeria/shared";
import { env } from "../env";

type AuthTokenPayload = {
  sub: string;
  role: AuthUserProfile["role"];
};

export function signAccessToken(user: AuthUserProfile): string {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
}
