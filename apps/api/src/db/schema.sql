-- emilIA — esquema relacional (SQLite). Informações clínicas ficam em tabela separada
-- e criptografada; o acesso é controlado por permissão explícita no backend.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('psychologist', 'secretary')),
  password_hash TEXT NOT NULL,
  mfa_secret_enc TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mfa_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT,
  user_agent TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Autorização específica para a secretaria acessar informações clínicas
-- (patient_id NULL = todos os pacientes). Concedida apenas pela psicóloga.
CREATE TABLE IF NOT EXISTS clinical_access_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  granted_by TEXT NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  ip TEXT,
  outcome TEXT NOT NULL DEFAULT 'ok'
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  birth_date TEXT,
  phone TEXT,
  email TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  modality TEXT NOT NULL DEFAULT 'presencial' CHECK (modality IN ('presencial', 'online', 'hibrido')),
  session_value_cents INTEGER NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'semanal' CHECK (frequency IN ('semanal', 'quinzenal', 'mensal', 'avulso')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'em_avaliacao', 'alta', 'lista_espera')),
  admin_notes TEXT,
  external_ref TEXT,            -- identificador estável na planilha (Etapa 4)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name);

CREATE TABLE IF NOT EXISTS responsibles (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('financeiro', 'emergencia')),
  name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT,
  email TEXT,
  document TEXT
);
CREATE INDEX IF NOT EXISTS idx_responsibles_patient ON responsibles(patient_id);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('presencial', 'online')),
  status TEXT NOT NULL DEFAULT 'agendada'
    CHECK (status IN ('agendada', 'confirmada', 'realizada', 'cancelada', 'falta', 'remarcada')),
  recurrence TEXT NOT NULL DEFAULT 'unica' CHECK (recurrence IN ('unica', 'semanal', 'quinzenal')),
  series_id TEXT,
  admin_notes TEXT,
  google_event_id TEXT,
  meet_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(starts_at);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  appointment_id TEXT REFERENCES appointments(id),
  reference_month TEXT NOT NULL,          -- AAAA-MM
  description TEXT,
  amount_cents INTEGER NOT NULL,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  paid_at TEXT,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'parcial', 'pago', 'atrasado', 'cancelado')),
  receipt_document_id TEXT,
  invoice_document_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_due ON payments(due_date);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id),
  kind TEXT NOT NULL CHECK (kind IN ('comprovante', 'nota_fiscal', 'contrato', 'declaracao', 'outro')),
  title TEXT NOT NULL,
  reference_month TEXT,
  drive_file_id TEXT,
  url TEXT,
  confidential INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Registros clínicos: conteúdo criptografado e acesso restrito.
CREATE TABLE IF NOT EXISTS clinical_records (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('prontuario', 'nota_sessao', 'protocolo_teste', 'documento_sigiloso')),
  content_enc TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('google_sheets', 'google_calendar', 'google_drive', 'whatsapp')),
  status TEXT NOT NULL DEFAULT 'nao_conectado' CHECK (status IN ('nao_conectado', 'configurando', 'conectado', 'erro')),
  config_json TEXT,
  connected_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT NOT NULL,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
