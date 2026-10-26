import { config } from "./config.js";
import { createApp } from "./app.js";
import { openDatabase } from "./db/connection.js";
import { seedIfEmpty } from "./db/seed.js";

openDatabase();
await seedIfEmpty();

const app = createApp();
app.listen(config.port, () => {
  console.log(`[api] emilIA API ouvindo em http://localhost:${config.port} (${config.isProd ? "produção" : "desenvolvimento"})`);
});
