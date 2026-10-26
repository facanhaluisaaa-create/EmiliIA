import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Avatar } from "./Avatar";

export interface PatientOption {
  id: string;
  fullName: string;
  status: string;
  modality: string;
  sessionValueCents: number;
}

/** Campo de busca e seleção de paciente (combobox acessível). */
export function PatientPicker({ value, onChange, error }: { value: PatientOption | null; onChange: (p: PatientOption | null) => void; error?: string | null }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PatientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();

  useEffect(() => {
    api<{ patients: PatientOption[] }>("/patients").then((r) => setOptions(r.patients));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = options.filter((o) => o.status !== "inativo" && o.status !== "alta");
    return (q ? list.filter((o) => o.fullName.toLowerCase().includes(q)) : list).slice(0, 8);
  }, [options, query]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        Paciente
      </label>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-sage-300 bg-sage-100/60 px-3 py-2">
          <Avatar name={value.fullName} size="sm" />
          <span className="flex-1 truncate text-sm">{value.fullName.replace(" (fictício)", "")}</span>
          <button type="button" className="text-xs font-medium text-forest hover:underline" onClick={() => onChange(null)}>
            Trocar
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-invalid={error ? true : undefined}
            placeholder="Buscar pelo nome"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && open && filtered[active]) {
                e.preventDefault();
                onChange(filtered[active]);
                setQuery("");
                setOpen(false);
              } else if (e.key === "Escape") setOpen(false);
            }}
            className={cn("h-11 w-full rounded-xl border bg-white pl-10 pr-3.5 text-sm focus:border-sage-500 focus:ring-0", error ? "border-status-bad" : "border-line hover:border-sage-400")}
          />
          {open && filtered.length > 0 && (
            <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-float">
              {filtered.map((o, i) => (
                <li
                  key={o.id}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(o);
                    setQuery("");
                    setOpen(false);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm", i === active ? "bg-sage-100" : "")}
                >
                  <Avatar name={o.fullName} size="sm" />
                  <span className="truncate">{o.fullName.replace(" (fictício)", "")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-status-bad">
          {error}
        </p>
      )}
    </div>
  );
}
