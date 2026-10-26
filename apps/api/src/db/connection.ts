import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const here = path.dirname(fileURLToPath(import.meta.url));

let instance: Database.Database | null = null;

export function openDatabase(dbPath: string = config.databasePath): Database.Database {
  if (instance) return instance;
  if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(path.join(here, "schema.sql"), "utf8");
  db.exec(schema);
  instance = db;
  return db;
}

export function getDb(): Database.Database {
  if (!instance) return openDatabase();
  return instance;
}

export function closeDatabase(): void {
  instance?.close();
  instance = null;
}
