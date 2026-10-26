export interface Contact {
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
}

export interface Patient {
  id: string;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  address: { street: string | null; city: string | null; state: string | null; zip: string | null };
  modality: "presencial" | "online" | "hibrido";
  sessionValueCents: number;
  frequency: "semanal" | "quinzenal" | "mensal" | "avulso";
  status: "ativo" | "inativo" | "em_avaliacao" | "alta" | "lista_espera";
  adminNotes: string | null;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
  financialResponsible: Contact | null;
  emergencyContact: Contact | null;
}

export interface DuplicateMatch {
  id: string;
  fullName: string;
  birthDate: string | null;
  status: string;
  reason: string;
}
