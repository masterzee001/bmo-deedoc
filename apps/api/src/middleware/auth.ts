import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@pics-nigeria/shared";
import { verifyAccessToken } from "../auth/jwt";
import { getAuthUserProfile } from "../auth/profile";
import { prisma } from "../prisma";

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

    if (user.accountStatus === "SUSPENDED") {
      return response.status(403).json({ message: "This account has been suspended." });
    }

    if (!user.isActive || user.accountStatus === "INACTIVE") {
      return response.status(403).json({ message: "This account has been deactivated." });
    }

    if (user.agentProfile) {
      const agentProfile = await prisma.agentProfile.findUnique({
        where: { userId: user.id },
        select: { activeSessionNonce: true },
      });

      if (!agentProfile || !payload.sessionNonce || agentProfile.activeSessionNonce !== payload.sessionNonce) {
        return response.status(401).json({ message: "This agent session is no longer active. Please sign in again." });
      }
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

export function requireMemberCapability(request: Request, response: Response, next: NextFunction) {
  const user = request.authUser;
  if (!user || (user.role !== "VOTER" && user.role !== "MEMBER") || !user.voterProfile) {
    return response.status(403).json({ message: "Member profile access is required." });
  }
  return next();
}

export function requirePollingUnitFieldCapability(request: Request, response: Response, next: NextFunction) {
  const user = request.authUser;
  const isLegacyAgent = user?.role === "AGENT";
  const isMigratedPollingUnitCoordinator =
    user?.role === "COORDINATOR" && user.coordinatorProfile?.level === "POLLING_UNIT";
  if (!user || (!isLegacyAgent && !isMigratedPollingUnitCoordinator) || !user.agentProfile) {
    return response.status(403).json({ message: "Polling Unit field operations access is required." });
  }
  return next();
}
