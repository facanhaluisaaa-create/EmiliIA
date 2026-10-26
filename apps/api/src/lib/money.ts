export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function clinicInfo(settings: Record<string, string>) {
  return {
    name: settings["clinic.name"] ?? "Espaço Psicológico Revisitare",
    professional: settings["clinic.professional"] ?? "Emília Sobral de Toledo Villena",
    crp: settings["clinic.crp"] ?? "CRP 06/203728",
  };
}

export function readSettings(db: import("better-sqlite3").Database): Record<string, string> {
  const rows = db.prepare(`SELECT key, value FROM settings`).all() as Array<{ key: string; value: string }>;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
