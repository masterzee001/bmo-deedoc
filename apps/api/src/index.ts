import http from "node:http";
import { createApp } from "./app";
import { env } from "./env";
import { attachRealtimeGateway, closeRealtimeGateway, getRealtimeGatewayStatus } from "./realtime/gateway";

const app = createApp();
const server = http.createServer(app);

void attachRealtimeGateway(server)
  .then(() => {
    console.log(`Realtime gateway status: ${getRealtimeGatewayStatus().runtimeStatus}`);
  })
  .catch((error) => {
    console.error("Realtime gateway startup failed.", error);
    if (env.REALTIME_REDIS_REQUIRED) {
      process.exit(1);
    }
  });

server.listen(env.PORT, () => {
  console.log(`PICS Nigeria API listening on port ${env.PORT}`);
});

async function shutdown() {
  await closeRealtimeGateway();
  await new Promise<void>((resolve, reject) =>
    server.close((error: NodeJS.ErrnoException | undefined) => {
      if (!error || error.code === "ERR_SERVER_NOT_RUNNING") {
        resolve();
        return;
      }
      reject(error);
    }),
  );
}

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
