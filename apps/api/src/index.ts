import { createApp } from "./app";
import { env } from "./env";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`PICS Nigeria API listening on port ${env.PORT}`);
});
