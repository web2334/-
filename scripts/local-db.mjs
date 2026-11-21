// Локальный PostgreSQL без Docker и без установки (пакет embedded-postgres).
// Данные лежат в ./.pgdata. Остановка — Ctrl+C.
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = fileURLToPath(new URL("../.pgdata", import.meta.url));
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: 54329, persistent: true });

if (!existsSync(dir + "/PG_VERSION")) await pg.initialise();
await pg.start();
// База в UTF-8 с ICU-локалью ru-RU: корректный поиск по кириллице (lower/ILIKE), как на управляемых PostgreSQL.
{
  const c = pg.getPgClient();
  await c.connect();
  const exists = await c.query("SELECT 1 FROM pg_database WHERE datname = 'vors'");
  if (exists.rowCount === 0) {
    await c.query("CREATE DATABASE vors ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE 'ru-RU' LOCALE 'C' TEMPLATE template0");
  }
  await c.end();
}
console.log("PostgreSQL запущен: postgres://postgres:postgres@127.0.0.1:54329/vors");

const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
