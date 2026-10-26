import cookieParser from "cookie-parser";
import express from "express";
import { attachSession } from "./auth/middleware.js";
import { authRouter } from "./auth/routes.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { csrfOriginCheck, helmetMiddleware, noCache } from "./middleware/security.js";
import { integrationsRouter } from "./integrations/routes.js";
import { agendaRouter } from "./modules/agenda/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { documentsRouter } from "./modules/documents/routes.js";
import { financeRouter } from "./modules/finance/routes.js";
import { reportsRouter } from "./modules/reports/routes.js";
import { patientsRouter } from "./modules/patients/routes.js";
import { settingsRouter } from "./modules/settings/routes.js";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmetMiddleware);
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(noCache);
  api.use(csrfOriginCheck);
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
  api.use("/settings", settingsRouter);
  api.use(notFound);

  app.use("/api", api);
  app.use(errorHandler);
  return app;
}
