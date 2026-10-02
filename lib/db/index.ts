import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dataDir } from "@/lib/paths";
import * as schema from "./schema";

const dir = dataDir();
fs.mkdirSync(dir, { recursive: true });

const dbPath = path.join(/*turbopackIgnore: true*/ dir, "app.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
console.log(`[db] base SQLite : ${dbPath} (persistante entre les redémarrages)`);

export const db = drizzle(sqlite, { schema });

// Les migrations s'appliquent au démarrage (app comme scripts), sauf pendant le build.
if (process.env.NEXT_PHASE !== "phase-production-build") {
  migrate(db, {
    migrationsFolder: path.join(/*turbopackIgnore: true*/ process.cwd(), "lib", "db", "migrations"),
  });
}

export * from "./schema";
