import { Paperclip } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { PatientPicker, type PatientOption } from "@/components/ui/PatientPicker";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/lib/api";
import { currentMonthKey } from "@/lib/format";
import { DOC_KIND_LABEL, type DocumentItem } from "./types";

export interface UploadPreset {
  patient?: PatientOption | null;
  kind?: DocumentItem["kind"];
  referenceMonth?: string | null;
  paymentId?: string | null;
  title?: string;
}

/** Envia o arquivo por multipart; nenhum conteúdo é armazenado no navegador. */
export async function uploadDocument(fields: Record<string, string>, file: File | null): Promise<DocumentItem> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v);
  if (file) form.append("file", file);
  const res = await fetch("/api/documents", { method: "POST", body: form, credentials: "same-origin" });
  const body = (await res.json().catch(() => ({}))) as { error?: string; document?: DocumentItem };
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Falha ao enviar o documento.");
  return body.document!;
}

export function UploadDocumentDialog({ open, onOpenChange, preset, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; preset?: UploadPreset | null; onSaved: (d: DocumentItem) => void }) {
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [kind, setKind] = useState<DocumentItem["kind"]>("comprovante");
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState(currentMonthKey());
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPatient(preset?.patient ?? null);
    setKind(preset?.kind ?? "comprovante");
    setTitle(preset?.title ?? "");
    setMonth(preset?.referenceMonth ?? currentMonthKey());
    setMode("file");
    setFile(null);
    setUrl("");
    setError(null);
  }, [open, preset]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "file" && !file) {
      setError("Selecione um arquivo (PDF, JPG, PNG ou WebP).");
      return;
    }
    setBusy(true);
    try {
      const d = await uploadDocument(
        { patientId: patient?.id ?? "", kind, title: title || `${DOC_KIND_LABEL[kind]} ${month}`, referenceMonth: month, url: mode === "link" ? url : "", paymentId: preset?.paymentId ?? "" },
        mode === "file" ? file : null
      );
      onSaved(d);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Novo documento" description="Arquivos ficam no armazenamento do servidor; com o Google Drive conectado, passam a ser enviados para a pasta do paciente.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="bad">{error}</Alert>}
        <PatientPicker value={patient} onChange={setPatient} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as DocumentItem["kind"])} options={Object.entries(DOC_KIND_LABEL).map(([value, label]) => ({ value, label }))} />
          <Input label="Competência" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${DOC_KIND_LABEL[kind]} ${month}`} />
        <div className="flex gap-1 rounded-xl border border-line bg-white p-1" role="group" aria-label="Origem do documento">
          {(["file", "link"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${mode === m ? "bg-forest text-cream" : "text-ink-muted hover:bg-sage-100"}`}>
              {m === "file" ? "Enviar arquivo" : "Informar link"}
            </button>
          ))}
        </div>
        {mode === "file" ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-sage-400 bg-white px-4 py-6 text-center text-sm text-ink-muted hover:bg-sage-100/40">
            <Paperclip className="h-5 w-5 text-sage-500" aria-hidden />
            <span>{file ? file.name : "Clique para escolher um arquivo (PDF, JPG, PNG, WebP · até 15 MB)"}</span>
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        ) : (
          <Input label="Link (Google Drive ou outro)" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" required />
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" loading={busy}>Salvar documento</Button>
        </div>
      </form>
    </Dialog>
  );
}
