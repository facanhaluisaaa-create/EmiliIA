export interface DocumentItem {
  id: string;
  patientId: string | null;
  patientName: string | null;
  kind: "comprovante" | "nota_fiscal" | "contrato" | "declaracao" | "outro";
  title: string;
  referenceMonth: string | null;
  storage: "none" | "local" | "link" | "drive";
  hasFile: boolean;
  driveFileId: string | null;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  paymentId: string | null;
  confidential: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export const DOC_KIND_LABEL: Record<DocumentItem["kind"], string> = {
  comprovante: "Comprovante",
  nota_fiscal: "Nota fiscal",
  contrato: "Contrato",
  declaracao: "Declaração",
  outro: "Outro",
};

export function documentHref(d: DocumentItem): string | null {
  if (d.storage === "link" && d.url) return d.url;
  if (d.hasFile) return `/api/documents/${d.id}/file`;
  return null;
}
