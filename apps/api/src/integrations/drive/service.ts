import { getDb } from "../../db/connection.js";
import { newId } from "../../lib/crypto.js";
import { googleFetch, isConnected } from "../google/client.js";

const ROOT_NAME = "emilIA";

interface DriveFile {
  id: string;
  name: string;
  webViewLink?: string;
}

function cachedFolder(key: string): string | null {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(`drive.folder.${key}`) as { value: string } | undefined;
  return row?.value ?? null;
}

function cacheFolder(key: string, id: string): void {
  getDb().prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).run(`drive.folder.${key}`, id);
}

async function findOrCreateFolder(name: string, parentId: string | null): Promise<string> {
  const key = `${parentId ?? "root"}/${name}`;
  const cached = cachedFolder(key);
  if (cached) return cached;
  const q = [`name = '${name.replace(/'/g, "\\'")}'`, `mimeType = 'application/vnd.google-apps.folder'`, "trashed = false", parentId ? `'${parentId}' in parents` : "'root' in parents"].join(" and ");
  const found = await googleFetch<{ files: DriveFile[] }>(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`);
  let id = found.files?.[0]?.id;
  if (!id) {
    const created = await googleFetch<DriveFile>("https://www.googleapis.com/drive/v3/files?fields=id,name", {
      method: "POST",
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: parentId ? [parentId] : undefined }),
    });
    id = created.id;
  }
  cacheFolder(key, id);
  return id;
}

/** Garante a estrutura emilIA/<Paciente>/<AAAA-MM> e retorna o id da pasta final. */
export async function ensurePatientFolder(patientName: string | null, month: string | null): Promise<string> {
  const root = await findOrCreateFolder(ROOT_NAME, null);
  const patientFolder = await findOrCreateFolder(patientName ? patientName.replace(/\(.*?\)/g, "").trim() : "Consultório", root);
  if (!month) return patientFolder;
  return findOrCreateFolder(month, patientFolder);
}

/** Envia um arquivo (multipart) para a pasta indicada. */
export async function uploadToDrive(buffer: Buffer, name: string, mimeType: string, folderId: string): Promise<DriveFile> {
  const boundary = `emiliia-${newId()}`;
  const metadata = JSON.stringify({ name, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  return googleFetch<DriveFile>("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", { method: "POST", headers: { "content-type": `multipart/related; boundary=${boundary}` }, body }, true);
}

export interface DriveUploadResult {
  skipped: boolean;
  fileId?: string;
  url?: string;
  error?: string;
}

/** Envia um documento já salvo localmente para o Drive e atualiza o registro. Nunca lança. */
export async function mirrorDocumentToDrive(documentId: string, buffer: Buffer, userId?: string | null): Promise<DriveUploadResult> {
  if (!isConnected("drive")) return { skipped: true };
  const db = getDb();
  const d = db
    .prepare(`SELECT d.id, d.title, d.mime_type, d.reference_month, p.full_name AS patient_name FROM documents d LEFT JOIN patients p ON p.id = d.patient_id WHERE d.id = ?`)
    .get(documentId) as { id: string; title: string; mime_type: string | null; reference_month: string | null; patient_name: string | null } | undefined;
  if (!d) return { skipped: true, error: "Documento não encontrado." };
  try {
    const folder = await ensurePatientFolder(d.patient_name, d.reference_month);
    const ext = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[d.mime_type ?? ""] ?? "";
    const file = await uploadToDrive(buffer, `${d.title}${ext}`, d.mime_type ?? "application/octet-stream", folder);
    db.prepare(`UPDATE documents SET storage = 'drive', drive_file_id = ?, url = ? WHERE id = ?`).run(file.id, file.webViewLink ?? null, d.id);
    db.prepare(`INSERT INTO sync_log (id, provider, kind, started_at, finished_at, status, summary, payload, user_id) VALUES (?, 'google_drive', 'upload', datetime('now'), datetime('now'), 'ok', ?, ?, ?)`).run(newId(), `Documento enviado ao Drive: ${d.title}`, JSON.stringify({ documentId: d.id, fileId: file.id }), userId ?? null);
    return { skipped: false, fileId: file.id, url: file.webViewLink };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.prepare(`INSERT INTO sync_log (id, provider, kind, started_at, finished_at, status, summary, payload, user_id) VALUES (?, 'google_drive', 'upload', datetime('now'), datetime('now'), 'erro', ?, ?, ?)`).run(newId(), `Falha ao enviar documento ao Drive: ${message}`, JSON.stringify({ documentId: d.id }), userId ?? null);
    return { skipped: false, error: message };
  }
}

export async function testConnection(): Promise<{ ok: boolean; rootFolderId: string }> {
  const root = await findOrCreateFolder(ROOT_NAME, null);
  return { ok: true, rootFolderId: root };
}
