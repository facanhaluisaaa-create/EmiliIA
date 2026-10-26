import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import { attachSession } from "./auth/middleware.js";
import { authRouter } from "./auth/routes.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { csrfOriginCheck, helmetMiddleware, noCache } from "./middleware/security.js";
import { integrationsRouter } from "./integrations/routes.js";
import { communicationRouter } from "./modules/communication/routes.js";
import { agendaRouter } from "./modules/agenda/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { documentsRouter } from "./modules/documents/routes.js";
import { financeRouter } from "./modules/finance/routes.js";
import { reportsRouter } from "./modules/reports/routes.js";
import { patientsRouter } from "./modules/patients/routes.js";
import { settingsRouter } from "./modules/settings/routes.js";
import { grantsRouter, usersRouter } from "./modules/settings/users.js";
import { mountStaticFrontend } from "./static.js";
import { config } from "./config.js";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmetMiddleware);
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Muitas requisições. Aguarde um instante." } }));
  api.use(noCache);
  // Webhooks de provedores externos (sem sessão) ficam fora da verificação de origem.
  const CSRF_EXEMPT = new Set(["/communication/whatsapp/webhook"]);
  api.use((req, res, next) => (CSRF_EXEMPT.has(req.path) ? next() : csrfOriginCheck(req, res, next)));
  api.use(attachSession);
  api.get("/health", (_req, res) => res.json({ ok: true, service: "emiliia-api" }));
  api.use("/auth", authRouter);
  api.use("/dashboard", dashboardRouter);
  api.use("/patients", patientsRouter);
  api.use("/agenda", agendaRouter);
  api.use("/finance", financeRouter);
  api.use("/documents", documentsRouter);
  api.use("/reports", reportsRouter);
  api.use("/integrations", integrationsRouter);
  api.use("/communication", communicationRouter);
  api.use("/settings/users", usersRouter);
  api.use("/settings/clinical-grants", grantsRouter);
  api.use("/settings", settingsRouter);
  api.use(notFound);

  app.use("/api", api);
  if (config.isProd) {
    const mounted = mountStaticFrontend(app);
    if (!mounted) console.warn("[api] frontend compilado não encontrado; execute `npm run build` ou defina WEB_DIST_DIR.");
  }
  app.use(errorHandler);
  return app;
}
