/**
 * Armazenamento da versão publicada: localStorage (sandbox pessoal) ou o banco
 * compartilhado do artefato (`db`), quando a pessoa está autenticada no claude.ai.
 * Nenhum segredo é guardado; o que é clínico fica no espaço privado da dona.
 */
import type { DemoState } from "./data";

type Doc = Record<string, unknown> & { id: string };
type AnyDb = { doc(path: string): any; collection(path: string): any };
type AnyUser = { isOwner(): Promise<boolean>; canEdit(): Promise<boolean>; can(n: string): Promise<boolean | null>; me(): Promise<{ id: string | null; name: string; isOwner: boolean }>; id(): Promise<string | null> };
type AnyAssets = { upload(blob: Blob): Promise<{ id: string; url: string; sizeBytes: number; contentType: string }> };

export interface Viewer {
  id: string;
  name: string;
  isOwner: boolean;
  canWrite: boolean;
}

/** Coleções compartilhadas e o campo de cada item em `DemoState`. */
const SHARED: Array<keyof DemoState> = ["patients", "responsibles", "appointments", "payments", "documents", "templates", "messages", "audit", "grants"];
const AUDIT_CAP = 300;

export class SharedStore {
  private db: AnyDb;
  private assets: AnyAssets | null;
  viewer: Viewer;
  private snapshot = new Map<string, Map<string, string>>();

  constructor(db: AnyDb, viewer: Viewer, assets: AnyAssets | null) {
    this.db = db;
    this.viewer = viewer;
    this.assets = assets;
  }

  /** Lê todas as coleções e preenche o estado. */
  async load(state: DemoState): Promise<void> {
    for (const name of SHARED) {
      let q = this.db.collection(name);
      if (name === "audit") q = q.orderBy("at", "desc").limit(AUDIT_CAP);
      else if (name === "appointments") q = q.orderBy("starts_at", "desc").limit(1000);
      else q = q.limit(1000);
      const snap = await q.get();
      const items = snap.docs.map((d: { data(): Record<string, unknown> }) => d.data() as Doc);
      (state as unknown as Record<string, unknown>)[name] = items;
      this.snapshot.set(name, new Map(items.map((i: Doc) => [i.id, JSON.stringify(i)])));
    }
    const settings = await this.db.doc("settings/main").get();
    if (settings.exists) state.settings = { ...state.settings, ...(settings.data() as Record<string, string>) };
    this.snapshot.set("settings", new Map([["main", JSON.stringify(state.settings)]]));
    if (this.viewer.isOwner) {
      const clin = await this.db.collection(`data/users/${this.viewer.id}/space/clinical`).limit(1000).get();
      state.clinical = clin.docs.map((d: { data(): Record<string, unknown> }) => d.data() as DemoState["clinical"][number]);
    } else state.clinical = [];
    this.snapshot.set("clinical", new Map(state.clinical.map((i) => [i.id, JSON.stringify(i)])));
    state.users = [];
    state.session = { userId: this.viewer.id, mfaVerified: true };
  }

  /** Grava apenas o que mudou desde a última gravação, um documento por vez. */
  async persist(state: DemoState): Promise<void> {
    for (const name of SHARED) {
      const items = (state as unknown as Record<string, Doc[]>)[name];
      if (name === "audit" && items.length > AUDIT_CAP) items.splice(AUDIT_CAP);
      const prev = this.snapshot.get(name) ?? new Map<string, string>();
      const next = new Map<string, string>();
      for (const item of items) {
        const json = JSON.stringify(item);
        next.set(String(item.id), json);
        if (prev.get(String(item.id)) !== json) await this.db.collection(name).doc(String(item.id)).set(JSON.parse(json));
      }
      for (const id of prev.keys()) if (!next.has(id)) await this.db.collection(name).doc(id).delete();
      this.snapshot.set(name, next);
    }
    const s = JSON.stringify(state.settings);
    if (this.snapshot.get("settings")?.get("main") !== s) {
      await this.db.doc("settings/main").set(JSON.parse(s));
      this.snapshot.set("settings", new Map([["main", s]]));
    }
    if (this.viewer.isOwner) {
      const prev = this.snapshot.get("clinical") ?? new Map<string, string>();
      const next = new Map<string, string>();
      for (const item of state.clinical) {
        const json = JSON.stringify(item);
        next.set(item.id, json);
        if (prev.get(item.id) !== json) await this.db.collection(`data/users/${this.viewer.id}/space/clinical`).doc(item.id).set(JSON.parse(json));
      }
      this.snapshot.set("clinical", next);
    }
  }

  /** Atualiza o estado quando outra pessoa grava (consulta periódica leve). */
  watch(state: DemoState, onChange: () => void): () => void {
    const unsubs: Array<() => void> = [];
    for (const name of ["patients", "appointments", "payments", "documents", "messages", "responsibles"] as const) {
      let q = this.db.collection(name);
      q = name === "appointments" ? q.orderBy("starts_at", "desc").limit(1000) : q.limit(1000);
      unsubs.push(
        q.onSnapshot(
          (snap: { metadata: { fromCache: boolean; hasPendingWrites: boolean }; docs: Array<{ data(): Record<string, unknown> }> }) => {
            if (snap.metadata.hasPendingWrites) return;
            const items = snap.docs.map((d) => d.data() as Doc);
            const map = new Map(items.map((i) => [String(i.id), JSON.stringify(i)]));
            const prev = this.snapshot.get(name);
            if (prev && prev.size === map.size && [...map].every(([k, v]) => prev.get(k) === v)) return;
            (state as unknown as Record<string, unknown>)[name] = items;
            this.snapshot.set(name, map);
            onChange();
          },
          () => undefined
        )
      );
    }
    return () => unsubs.forEach((u) => u());
  }

  async uploadFile(file: File): Promise<{ url: string; id: string } | null> {
    if (!this.assets) return null;
    const r = await this.assets.upload(file);
    return { url: r.url, id: r.id };
  }
}

/** Tenta ligar o banco compartilhado. Resolve null fora do visualizador do claude.ai ou sem sessão. */
export async function connectShared(): Promise<SharedStore | null> {
  const claude = (window as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;
  if (!claude?.use) return null;
  const [db, user, assets] = await Promise.all([claude.use("db") as Promise<AnyDb | null>, claude.use("user") as Promise<AnyUser | null>, claude.use("assets") as Promise<AnyAssets | null>]);
  if (!db || !user) return null;
  const me = await user.me();
  if (!me.id) return null;
  const canWrite = (await user.can("data.write")) ?? true;
  return new SharedStore(db, { id: me.id, name: me.name || "", isOwner: me.isOwner, canWrite }, assets);
}
