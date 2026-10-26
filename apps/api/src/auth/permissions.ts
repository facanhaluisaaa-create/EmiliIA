export type Role = "psychologist" | "secretary";

export type Permission =
  | "dashboard:read"
  | "patients:read"
  | "patients:write"
  | "agenda:read"
  | "agenda:write"
  | "finance:read"
  | "finance:write"
  | "documents:read"
  | "documents:write"
  | "communication:read"
  | "communication:send"
  | "reports:read"
  | "settings:read"
  | "integrations:manage"
  | "users:manage"
  | "audit:read"
  | "clinical:read"
  | "clinical:write"
  | "clinical:grant";

const ADMIN_PERMISSIONS: Permission[] = [
  "dashboard:read",
  "patients:read",
  "patients:write",
  "agenda:read",
  "agenda:write",
  "finance:read",
  "finance:write",
  "documents:read",
  "documents:write",
  "communication:read",
  "communication:send",
  "reports:read",
  "settings:read",
];

/**
 * Permissões por perfil. Informações clínicas (clinical:*) são exclusivas da
 * psicóloga; a secretaria só as acessa mediante autorização específica
 * registrada em clinical_access_grants (ver middleware).
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  psychologist: [
    ...ADMIN_PERMISSIONS,
    "integrations:manage",
    "users:manage",
    "audit:read",
    "clinical:read",
    "clinical:write",
    "clinical:grant",
  ],
  secretary: [...ADMIN_PERMISSIONS, "audit:read"],
};

export const ROLE_LABELS: Record<Role, string> = {
  psychologist: "Psicóloga responsável",
  secretary: "Secretaria administrativa",
};

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
