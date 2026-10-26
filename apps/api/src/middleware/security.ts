import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { config } from "../config.js";

export const helmetMiddleware = helmet({
  contentSecurityPolicy: config.isProd
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      }
    : false,
  referrerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
});

/**
 * Proteção CSRF: cookies SameSite=Strict + verificação de origem em requisições
 * que alteram estado. Requisições sem Origin/Referer são rejeitadas (exceto GET/HEAD/OPTIONS).
 */
export function csrfOriginCheck(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  const allowed = new Set([config.webOrigin, `http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`]);
  const origin = req.get("origin");
  const referer = req.get("referer");
  let source: string | null = origin ?? null;
  if (!source && referer) {
    try {
      source = new URL(referer).origin;
    } catch {
      source = null;
    }
  }
  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite === "same-origin" || (source && allowed.has(source))) {
    next();
    return;
  }
  res.status(403).json({ error: "Origem da requisição não permitida." });
}

export function noCache(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store");
  next();
}
