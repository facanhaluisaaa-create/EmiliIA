import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Em produção a API serve o frontend compilado (apps/web/dist) na mesma origem,
 * o que simplifica cookies, CSP e a verificação de origem.
 */
export function mountStaticFrontend(app: express.Express): boolean {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [process.env.WEB_DIST_DIR, path.resolve(here, "../../web/dist"), path.resolve(here, "../../../web/dist")].filter(Boolean) as string[];
  const dist = candidates.find((c) => fs.existsSync(path.join(c, "index.html")));
  if (!dist) return false;
  app.use(express.static(dist, { index: false, maxAge: "1h", setHeaders: (res, filePath) => { if (filePath.includes("/assets/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); } }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(dist, "index.html"));
  });
  return true;
}
