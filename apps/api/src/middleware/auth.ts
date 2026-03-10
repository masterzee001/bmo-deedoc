import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@pics-nigeria/shared";
import { verifyAccessToken } from "../auth/jwt";
import { getAuthUserProfile } from "../auth/profile";

declare global {
  namespace Express {
    interface Request {
      authUser?: Awaited<ReturnType<typeof getAuthUserProfile>>;
    }
  }
}

function readBearerToken(header?: string): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = readBearerToken(request.headers.authorization);

  if (!token) {
    return response.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await getAuthUserProfile(payload.sub);

    if (!user) {
      return response.status(401).json({ message: "User not found." });
    }

    if (!user.isActive) {
      return response.status(403).json({ message: "This account has been deactivated." });
    }

    request.authUser = user;
    return next();
  } catch {
    return response.status(401).json({ message: "Invalid or expired token." });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.authUser) {
      return response.status(401).json({ message: "Authentication required." });
    }

    if (!roles.includes(request.authUser.role)) {
      return response.status(403).json({ message: "You do not have permission to access this resource." });
    }

    return next();
  };
}
