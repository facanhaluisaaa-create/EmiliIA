import { Archive, ArchiveRestore, ExternalLink, FileText, FolderOpen, Image as ImageIcon, Link2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PatientPicker, type PatientOption } from "@/components/ui/PatientPicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, patch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatBytes, formatDateTime, monthLabelLong } from "@/lib/format";
import { DOC_KIND_LABEL, documentHref, type DocumentItem } from "./types";
import { UploadDocumentDialog } from "./UploadDocumentDialog";

const KIND_TONE: Record<DocumentItem["kind"], "sage" | "info" | "neutral" | "warn" | "good"> = { comprovante: "sage", nota_fiscal: "info", contrato: "neutral", declaracao: "warn", outro: "neutral" };

export function DocumentsPage() {
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [month, setMonth] = useState("");
  const [kind, setKind] = useState("");
  const [archived, setArchived] = useState(false);
  const [months, setMonths] = useState<string[]>([]);
  const [docs, setDocs] = useState<DocumentItem[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const { can } = useAuth();

  const load = useCallback(() => {
    const params = new URLSearchParams({ patientId: patient?.id ?? "", month, kind, archived: archived ? "1" : "0" });
    return api<{ documents: DocumentItem[]; months: string[] }>(`/documents?${params}`).then((r) => {
      setDocs(r.documents);
      setMonths(r.months);
    });
  }, [patient, month, kind, archived]);

  useEffect(() => {
    setDocs(null);
    void load();
  }, [load]);

  // Agrupa por paciente e competência, conforme a organização solicitada.
  const groups = new Map<string, DocumentItem[]>();
  for (const d of docs ?? []) {
    const key = `${d.patientName ?? "Consultório"}|${d.referenceMonth ?? "Sem competência"}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Arquivo"
        title="Documentos"
        description="Comprovantes, notas fiscais, contratos e declarações organizados por paciente e competência."
        action={can("documents:write") && (
          <Button onClick={() => setUploading(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Novo documento
          </Button>
        )}
      />
      <div className="mb-4">
        <DemoBanner text="Arquivos ficam no servidor. Quando o Google Drive for conectado nas Configurações, os novos envios irão para a pasta do consultório." />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <PatientPicker value={patient} onChange={setPatient} />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" htmlFor="doc-month">Competência</label>
          <select id="doc-month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-sm">
            <option value="">Todas</option>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabelLong(m)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Tipo</span>
          <div className="flex h-11 items-center gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1" role="group" aria-label="Tipo de documento">
            {[["", "Todos"], ...Object.entries(DOC_KIND_LABEL)].map(([value, label]) => (
              <button key={value} onClick={() => setKind(value)} aria-pressed={kind === value} className={cn("shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium", kind === value ? "bg-forest text-cream" : "text-ink-muted hover:bg-sage-100")}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="mb-4 flex items-center gap-2 text-xs text-ink-muted">
        <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="h-3.5 w-3.5 rounded border-line" /> Incluir arquivados
      </label>

      {docs === null ? (
        <Skeleton className="h-64" />
      ) : groups.size === 0 ? (
        <Card>
          <EmptyState icon={<FolderOpen className="h-6 w-6" aria-hidden />} title="Nenhum documento encontrado" description="Ajuste os filtros ou envie um novo documento." />
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([key, items]) => {
            const [name, ref] = key.split("|");
            return (
              <Card key={key}>
                <CardHeader title={name.replace(" (fictício)", "")} subtitle={ref === "Sem competência" ? ref : monthLabelLong(ref)} action={items[0].patientId ? <Link to={`/pacientes/${items[0].patientId}?aba=documentos`} className="text-xs font-medium text-forest hover:underline">Ver paciente</Link> : undefined} />
                <ul className="divide-y divide-line border-t border-line">
                  {items.map((d) => {
                    const href = documentHref(d);
                    return (
                      <li key={d.id} className={cn("flex items-center gap-3 px-5 py-3 sm:px-6", d.archivedAt && "opacity-60")}>
                        <span className="rounded-lg bg-sage-100 p-2 text-forest">
                          {d.storage === "link" ? <Link2 className="h-4 w-4" aria-hidden /> : d.mimeType?.startsWith("image/") ? <ImageIcon className="h-4 w-4" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{d.title}</p>
                          <p className="text-[11px] text-ink-muted">
                            {formatDateTime(d.createdAt)}{d.sizeBytes ? ` · ${formatBytes(d.sizeBytes)}` : ""}{d.paymentId ? " · vinculado a cobrança" : ""}{d.storage === "drive" ? " · Google Drive" : ""}
                          </p>
                        </div>
                        <Badge tone={KIND_TONE[d.kind]}>{DOC_KIND_LABEL[d.kind]}</Badge>
                        {href && (
                          <a href={href} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-forest hover:bg-sage-100" aria-label="Abrir documento">
                            <ExternalLink className="h-4 w-4" aria-hidden />
                          </a>
                        )}
                        {can("documents:write") && (
                          <button onClick={() => patch(`/documents/${d.id}/archive`).then(load)} className="rounded-lg p-2 text-ink-muted hover:bg-sage-100 hover:text-forest" aria-label={d.archivedAt ? "Restaurar" : "Arquivar"}>
                            {d.archivedAt ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <UploadDocumentDialog open={uploading} onOpenChange={setUploading} preset={{ patient }} onSaved={() => void load()} />
    </div>
  );
}
