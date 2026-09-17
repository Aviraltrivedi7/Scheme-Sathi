/**
 * Local demo run: in-memory MySQL + bundled production server, held open so
 * the browser can hit it. Ctrl+C or TaskStop to tear down.
 */
import { execSync, spawn } from "node:child_process";
import mysqlMemory from "mysql-memory-server";

const { createDB } = mysqlMemory;
const server = await createDB({});
const url = `mysql://root@127.0.0.1:${server.port}/scheme_sathi`;
console.log(`[demo] MySQL on port ${server.port}`);

const admin = await (await import("mysql2/promise")).createConnection({
  host: "127.0.0.1", port: server.port, user: "root", multipleStatements: true,
});
await admin.query("CREATE DATABASE IF NOT EXISTS scheme_sathi");
await admin.end();

execSync("npx drizzle-kit push --force", {
  env: { ...process.env, DATABASE_URL: url },
  stdio: "pipe",
  timeout: 180000,
});
console.log("[demo] schema pushed");

const app = spawn("node", ["dist/index.js"], {
  env: { ...process.env, DATABASE_URL: url, NODE_ENV: "production", PORT: "3210" },
  stdio: "inherit",
});

// Keep alive until killed; clean up MySQL on exit.
const stop = async () => {
  app.kill();
  await server.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
app.on("exit", () => { void server.stop().catch(() => {}); process.exit(0); });

setInterval(() => {}, 1 << 30);
