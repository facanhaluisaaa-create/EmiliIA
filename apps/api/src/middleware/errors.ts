import type { NextFunction, Request, Response } from "express";

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Rota não encontrada." });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
  if (status >= 500) console.error("[api] erro não tratado:", err);
  res.status(status).json({ error: status >= 500 ? "Erro interno. Tente novamente." : String((err as Error).message) });
}
