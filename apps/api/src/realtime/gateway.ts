import type http from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import {
  ELECTION_DAY_REALTIME_EVENT_TYPES,
  VOICE_CALL_SIGNAL_TYPES,
  type AuthUserProfile,
  type ElectionDayRealtimeEnvelope,
  type OperationalTerritory,
  type RealtimeGatewayStatus,
  type RealtimePresenceState,
} from "@pics-nigeria/shared";
import { createClient, type RedisClientType } from "redis";
import { Server, type Socket } from "socket.io";
import { authorizeAction, resolveOperationalTerritory } from "../authorization";
import { getAuthUserProfile } from "../auth/profile";
import { verifyAccessToken } from "../auth/jwt";
import { env } from "../env";
import { canContactUser } from "../lib/messaging-permissions";
import { prisma } from "../prisma";
import {
  commandScopeForRealtimeActor,
  realtimeRoomForScope,
  realtimeRoomsForTerritory,
  userPresenceRoom,
} from "./rooms";

type AuthenticatedSocket = Socket & {
  data: {
    authUser: AuthUserProfile;
  };
};

type PresenceEntry = {
  userId: string;
  state: RealtimePresenceState;
  lastSeenAt: string;
  socketCount: number;
};

type SubscribePayload = {
  territory?: OperationalTerritory;
};

let ioServer: Server | null = null;
let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;
let gatewayStatus: RealtimeGatewayStatus = {
  runtimeStatus: "TARGET_NOT_RUNNING",
  restFallbackAvailable: true,
  transport: "socket.io",
  redisAdapter: "not_configured",
  contractVersion: 1,
  eventTypes: [...ELECTION_DAY_REALTIME_EVENT_TYPES],
};

const localPresence = new Map<string, PresenceEntry>();

function readHandshakeToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim();
  }

  const header = socket.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }

  return null;
}

async function authenticateSocket(socket: Socket): Promise<AuthUserProfile> {
  const token = readHandshakeToken(socket);
  if (!token) {
    throw new Error("Authentication required.");
  }

  const payload = verifyAccessToken(token);
  const user = await getAuthUserProfile(payload.sub);
  if (!user || !user.isActive || user.accountStatus !== "ACTIVE") {
    throw new Error("Active account required.");
  }

  if (user.agentProfile) {
    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: user.id },
      select: { activeSessionNonce: true },
    });
    if (!agentProfile || !payload.sessionNonce || agentProfile.activeSessionNonce !== payload.sessionNonce) {
      throw new Error("Current field session required.");
    }
  }

  return user;
}

function allowedSocketOrigins() {
  return env.REALTIME_ALLOWED_ORIGINS.length > 0 ? env.REALTIME_ALLOWED_ORIGINS : env.CORS_ALLOWED_ORIGINS;
}

function updateLocalPresence(userId: string, state: RealtimePresenceState, delta: -1 | 0 | 1 = 0) {
  const existing = localPresence.get(userId);
  const socketCount = Math.max((existing?.socketCount || 0) + delta, 0);
  const next: PresenceEntry = {
    userId,
    state: socketCount > 0 ? state : "OFFLINE",
    lastSeenAt: new Date().toISOString(),
    socketCount,
  };
  localPresence.set(userId, next);
  return next;
}

async function writeRedisPresence(entry: PresenceEntry) {
  if (!pubClient || gatewayStatus.redisAdapter !== "connected") {
    return;
  }

  try {
    await pubClient.set(`presence:user:${entry.userId}`, JSON.stringify(entry), { EX: env.REALTIME_PRESENCE_TTL_SECONDS });
  } catch {
    gatewayStatus = {
      ...gatewayStatus,
      runtimeStatus: "DEGRADED_REDIS_UNAVAILABLE",
      redisAdapter: "unavailable",
    };
  }
}

async function publishPresence(socket: AuthenticatedSocket, state: RealtimePresenceState, delta: -1 | 0 | 1 = 0) {
  const entry = updateLocalPresence(socket.data.authUser.id, state, delta);
  await writeRedisPresence(entry);
  ioServer?.to(userPresenceRoom(socket.data.authUser.id)).emit("presence.updated", entry);
}

async function configureRedisAdapter(io: Server) {
  if (!env.REDIS_URL) {
    gatewayStatus = {
      ...gatewayStatus,
      runtimeStatus: "DEGRADED_NO_REDIS",
      redisAdapter: "not_configured",
    };
    return;
  }

  try {
    pubClient = createClient({ url: env.REDIS_URL }) as RedisClientType;
    subClient = pubClient.duplicate() as RedisClientType;
    pubClient.on("error", () => {
      gatewayStatus = {
        ...gatewayStatus,
        runtimeStatus: "DEGRADED_REDIS_UNAVAILABLE",
        redisAdapter: "unavailable",
      };
    });
    subClient.on("error", () => {
      gatewayStatus = {
        ...gatewayStatus,
        runtimeStatus: "DEGRADED_REDIS_UNAVAILABLE",
        redisAdapter: "unavailable",
      };
    });
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    gatewayStatus = {
      ...gatewayStatus,
      runtimeStatus: "AVAILABLE",
      redisAdapter: "connected",
    };
  } catch (error) {
    gatewayStatus = {
      ...gatewayStatus,
      runtimeStatus: "DEGRADED_REDIS_UNAVAILABLE",
      redisAdapter: "unavailable",
    };
    if (env.REALTIME_REDIS_REQUIRED) {
      throw error;
    }
  }
}

async function authorizeSubscription(actor: AuthUserProfile, territory?: OperationalTerritory) {
  const requestedScope = territory || commandScopeForRealtimeActor(actor);
  if (!requestedScope) {
    return null;
  }
  const resolved = await resolveOperationalTerritory(prisma, requestedScope);
  if (!authorizeAction(actor, "VIEW_TERRITORY", resolved)) {
    return null;
  }
  return requestedScope;
}

function registerHandlers(socket: AuthenticatedSocket) {
  socket.join(userPresenceRoom(socket.data.authUser.id));
  void publishPresence(socket, "ONLINE", 1);

  socket.emit("realtime.connected", {
    status: gatewayStatus,
    userId: socket.data.authUser.id,
    reconnect: {
      recovered: socket.recovered,
      reconcileRequired: !socket.recovered,
      snapshotPath: "/election-day/situation-room/status",
    },
  });

  if (!socket.recovered) {
    socket.emit("realtime.reconcile.required", {
      reason: "Durable replay outbox is not implemented in this branch; reconcile from REST snapshot after connect/reconnect.",
      snapshotPath: "/election-day/situation-room/status",
    });
  }

  socket.on("election.subscribe", async (payload: SubscribePayload, acknowledge?: (response: Record<string, unknown>) => void) => {
    try {
      const scope = await authorizeSubscription(socket.data.authUser, payload?.territory);
      if (!scope) {
        acknowledge?.({ ok: false, message: "Subscription denied for this territory." });
        return;
      }

      const room = realtimeRoomForScope(scope);
      await socket.join(room);
      acknowledge?.({
        ok: true,
        room,
        territory: scope,
        reconnect: {
          reconcileRequired: true,
          snapshotPath: "/election-day/situation-room/status",
        },
      });
    } catch (error) {
      acknowledge?.({ ok: false, message: error instanceof Error ? error.message : "Subscription failed." });
    }
  });

  socket.on("election.unsubscribe", async (payload: SubscribePayload, acknowledge?: (response: Record<string, unknown>) => void) => {
    const scope = payload?.territory;
    if (!scope) {
      acknowledge?.({ ok: false, message: "Territory is required." });
      return;
    }
    const room = realtimeRoomForScope(scope);
    await socket.leave(room);
    acknowledge?.({ ok: true, room });
  });

  socket.on("presence.heartbeat", async (payload?: { state?: RealtimePresenceState }, acknowledge?: (response: Record<string, unknown>) => void) => {
    const state = payload?.state || "ONLINE";
    if (!["ONLINE", "ACTIVE_RECENTLY", "IN_CALL"].includes(state)) {
      acknowledge?.({ ok: false, message: "Unsupported presence state." });
      return;
    }
    await publishPresence(socket, state);
    acknowledge?.({ ok: true, state });
  });

  // Transient WebRTC signalling only. Durable call lifecycle transitions are
  // owned by the REST routes under /election-day/calls; this relay never
  // creates or mutates call state, and never persists a signal body.
  socket.on("call.signal", async (payload?: {
    conversationId?: string;
    targetUserId?: string;
    callId?: string;
    signalType?: "offer" | "answer" | "candidate";
    signal?: unknown;
  }, acknowledge?: (response: Record<string, unknown>) => void) => {
    if (!payload?.targetUserId || !payload.signalType || !payload.callId) {
      acknowledge?.({ ok: false, message: "callId, targetUserId, and signalType are required." });
      return;
    }

    if (!VOICE_CALL_SIGNAL_TYPES.includes(payload.signalType)) {
      acknowledge?.({ ok: false, message: "Unsupported signal type." });
      return;
    }

    // The signal may only be relayed between two live participants of a call
    // that is still in progress, and only when the contact rule permits it.
    const call = await prisma.voiceCall.findUnique({
      where: { id: payload.callId },
      select: { id: true, status: true, participants: { select: { userId: true, status: true } } },
    });
    const participantIds = new Set(call?.participants.map((participant) => participant.userId) || []);
    if (
      !call ||
      call.status === "ENDED" ||
      !participantIds.has(socket.data.authUser.id) ||
      !participantIds.has(payload.targetUserId)
    ) {
      acknowledge?.({ ok: false, message: "Signal denied for this call." });
      return;
    }

    if (!(await canContactUser(socket.data.authUser, payload.targetUserId))) {
      acknowledge?.({ ok: false, message: "Signal denied for this call." });
      return;
    }

    ioServer?.to(userPresenceRoom(payload.targetUserId)).emit("call.signal", {
      callId: call.id,
      conversationId: payload.conversationId || null,
      fromUserId: socket.data.authUser.id,
      targetUserId: payload.targetUserId,
      signalType: payload.signalType,
      signal: payload.signal ?? null,
      occurredAt: new Date().toISOString(),
      recording: "DISABLED",
    });
    acknowledge?.({ ok: true, eventName: "call.signal", recording: "DISABLED" });
  });

  socket.on("disconnect", () => {
    void publishPresence(socket, "OFFLINE", -1);
  });
}

export async function attachRealtimeGateway(server: http.Server): Promise<Server> {
  if (ioServer) {
    return ioServer;
  }

  const allowedOrigins = new Set(allowedSocketOrigins());
  const io = new Server(server, {
    path: env.REALTIME_PATH,
    connectionStateRecovery: {
      maxDisconnectionDuration: env.REALTIME_CONNECTION_STATE_RECOVERY_MS,
      skipMiddlewares: false,
    },
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Realtime CORS origin not allowed."));
      },
    },
  });

  ioServer = io;
  gatewayStatus = {
    ...gatewayStatus,
    runtimeStatus: "DEGRADED_NO_REDIS",
    redisAdapter: "not_configured",
  };

  await configureRedisAdapter(io);

  io.use(async (socket, next) => {
    try {
      const user = await authenticateSocket(socket);
      (socket as AuthenticatedSocket).data.authUser = user;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Realtime authentication failed."));
    }
  });

  io.on("connection", (socket) => registerHandlers(socket as AuthenticatedSocket));
  return io;
}

export function publishRealtimeEvent(event: ElectionDayRealtimeEnvelope): boolean {
  if (!ioServer) {
    return false;
  }

  const rooms = realtimeRoomsForTerritory(event.territory);
  if (rooms.length === 0) {
    ioServer.emit(event.eventType, event);
    ioServer.emit("realtime.event", event);
    return true;
  }

  ioServer.to(rooms).emit(event.eventType, event);
  ioServer.to(rooms).emit("realtime.event", event);
  return true;
}

/**
 * Deliver an event only to the named users' presence rooms. Call signalling and
 * lifecycle are point-to-point, so they must never fan out to a territory room
 * where non-participants are subscribed.
 */
export function publishRealtimeEventToUsers(event: ElectionDayRealtimeEnvelope, userIds: string[]): boolean {
  if (!ioServer || userIds.length === 0) {
    return false;
  }

  const rooms = Array.from(new Set(userIds)).map((userId) => userPresenceRoom(userId));
  ioServer.to(rooms).emit(event.eventType, event);
  ioServer.to(rooms).emit("realtime.event", event);
  return true;
}

export function getRealtimeGatewayStatus(): RealtimeGatewayStatus {
  return gatewayStatus;
}

export function getPresenceSnapshot(userIds: string[]) {
  const now = new Date().toISOString();
  return userIds.map((userId) => {
    const entry = localPresence.get(userId);
    return {
      userId,
      state: entry?.state || "OFFLINE",
      lastSeenAt: entry?.lastSeenAt || now,
      socketCount: entry?.socketCount || 0,
    };
  });
}

export async function closeRealtimeGateway() {
  if (ioServer) {
    await ioServer.close();
    ioServer = null;
  }
  await Promise.allSettled([pubClient?.quit(), subClient?.quit()]);
  pubClient = null;
  subClient = null;
  localPresence.clear();
  gatewayStatus = {
    runtimeStatus: "TARGET_NOT_RUNNING",
    restFallbackAvailable: true,
    transport: "socket.io",
    redisAdapter: "not_configured",
    contractVersion: 1,
    eventTypes: [...ELECTION_DAY_REALTIME_EVENT_TYPES],
  };
}
