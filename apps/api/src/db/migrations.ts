import type Database from "better-sqlite3";

/**
 * Migrações incrementais para colunas adicionadas após o esquema inicial.
 * Cada entrada roda uma única vez (registrada em schema_migrations).
 */
const MIGRATIONS: Array<{ name: string; sql: string[] }> = [
  {
    name: "0002_documents_storage",
    sql: [
      `ALTER TABLE documents ADD COLUMN storage TEXT NOT NULL DEFAULT 'none'`,
      `ALTER TABLE documents ADD COLUMN file_path TEXT`,
      `ALTER TABLE documents ADD COLUMN mime_type TEXT`,
      `ALTER TABLE documents ADD COLUMN size_bytes INTEGER`,
      `ALTER TABLE documents ADD COLUMN uploaded_by TEXT`,
      `ALTER TABLE documents ADD COLUMN archived_at TEXT`,
      `ALTER TABLE documents ADD COLUMN payment_id TEXT`,
    ],
  },
  {
    name: "0003_payments_notes",
    sql: [`ALTER TABLE payments ADD COLUMN notes TEXT`, `ALTER TABLE payments ADD COLUMN updated_at TEXT`],
  },
  {
    name: "0004_sync_log_details",
    sql: [`ALTER TABLE sync_log ADD COLUMN kind TEXT`, `ALTER TABLE sync_log ADD COLUMN payload TEXT`, `ALTER TABLE sync_log ADD COLUMN user_id TEXT`],
  },
  {
    name: "0005_appointments_sync",
    sql: [`ALTER TABLE appointments ADD COLUMN calendar_synced_at TEXT`],
  },
];

export function runMigrations(db: Database.Database): void {
  const applied = new Set((db.prepare(`SELECT name FROM schema_migrations`).all() as Array<{ name: string }>).map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    db.transaction(() => {
      for (const stmt of m.sql) {
        try {
          db.exec(stmt);
        } catch (err) {
          // Coluna já existente (banco criado com esquema mais novo): ignora.
          if (!String(err).includes("duplicate column name")) throw err;
        }
      }
      db.prepare(`INSERT INTO schema_migrations (name) VALUES (?)`).run(m.name);
    })();
  }
}
