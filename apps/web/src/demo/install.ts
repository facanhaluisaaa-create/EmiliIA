import { getDocumentUrl, handleDemoRequest, initStore } from "./mockApi";

export const isDemo = import.meta.env.VITE_DEMO === "1";

/** Redireciona todas as chamadas a /api para a API simulada, sem tocar em outras requisições. */
export async function installDemo(): Promise<void> {
  installDemoLinkGuard();
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith("/api/") || url.startsWith(`${location.origin}/api/`)) return handleDemoRequest(input, init);
    return original(input, init);
  };
  await initStore();
}

function toast(text: string): void {
  const el = document.createElement("div");
  el.textContent = text;
  el.setAttribute("role", "status");
  el.style.cssText = "position:fixed;left:50%;bottom:88px;transform:translateX(-50%);background:#1D2924;color:#F5F5F0;padding:10px 16px;border-radius:12px;font:14px Inter,system-ui,sans-serif;z-index:9999;max-width:90vw;box-shadow:0 12px 40px rgba(29,41,36,.25)";
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 3200);
}

/** Links diretos para PDFs e arquivos não existem na demonstração: avisa em vez de abrir uma página em branco. */
export function installDemoLinkGuard(): void {
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.("a[href^='/api/']") as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    const m = a.getAttribute("href")?.match(/^\/api\/documents\/([^/]+)\/file$/);
    if (m) {
      const url = getDocumentUrl(m[1]);
      if (url) { window.open(url, "_blank", "noopener"); return; }
      toast("Este documento não tem arquivo guardado.");
      return;
    }
    toast("Na demonstração, PDFs e arquivos não são gerados. No sistema instalado, este botão abre o documento.");
  });
}
