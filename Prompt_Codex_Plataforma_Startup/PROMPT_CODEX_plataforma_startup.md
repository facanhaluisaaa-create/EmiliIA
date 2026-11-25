# Prompt para o Codex — Plataforma de organização para startup ("Rumo")

> Cole tudo abaixo no Codex. O nome "Rumo" é provisório: troque à vontade.
> Escrito a partir da experiência do projeto EmilIA (mesma base de arquitetura e de segurança), mas **sem nada de psicologia, WhatsApp, e-mail ou envio de mensagens**.

---

## 1. Objetivo

Construa uma plataforma web chamada **Rumo** para organizar uma startup em crescimento. Ela reúne, num só lugar:

1. **Agenda** conectada ao **Google Agenda** da equipe.
2. **Financeiro** da empresa: entradas, saídas, contas a pagar/receber, caixa, burn rate e runway.
3. **O que fazer**: tarefas, projetos, prazos e a visão "hoje / esta semana / próximos 30 dias".

Público: fundadores, operações e financeiro de uma startup de 5 a 50 pessoas. Interface em **português do Brasil**, valores em **R$**, fuso **America/Sao_Paulo**.

**Fora do escopo (não implementar):** WhatsApp, SMS, envio de e-mail, notificações por mensagem, chat entre usuários, integração bancária automática (open finance) e emissão de nota fiscal.

## 2. Stack obrigatória

- Monorepo com npm workspaces: `apps/web` e `apps/api`.
- **Frontend:** React 18 + Vite + TypeScript (strict) + Tailwind CSS + React Router + TanStack Query. Ícones `lucide-react`. Gráficos com `recharts`.
- **Backend:** Node 20+ + TypeScript + Fastify (ou Express) + Zod para validar toda entrada.
- **Banco:** SQLite em desenvolvimento via **Drizzle ORM** (ou Prisma), com migrações; o código deve funcionar trocando para PostgreSQL só pela variável `DATABASE_URL`.
- **Google:** biblioteca oficial `googleapis`.
- **Testes:** Vitest (unitários e de API) + Playwright (fluxos principais).
- Versões fixas no `package.json` (sem `^`), `.env.example` documentado, `npm run dev` sobe tudo.

## 3. Usuários e permissões

Papéis (RBAC verificado **no backend**, nunca só na tela):

| Papel | Pode |
|---|---|
| **Admin** (fundador) | tudo, inclusive usuários, integrações, categorias e auditoria |
| **Financeiro** | ver e editar o financeiro, ver agenda e tarefas |
| **Membro** | agenda e tarefas; **não** vê o financeiro (só o card "caixa" do painel, se o Admin liberar) |

- Login com e-mail e senha (hash **argon2id**), sessão em cookie `httpOnly`, `Secure`, `SameSite=Lax`, expiração de 8 h, proteção CSRF nas rotas que alteram dados, limite de tentativas de login.
- Verificação em duas etapas (TOTP) opcional por usuário.
- Toda ação que cria, altera ou exclui dados financeiros, usuários ou integrações gera linha na **auditoria** (quem, quando, o quê, antes/depois).

## 4. Módulos

### 4.1 Painel (página inicial)
- **Hoje:** eventos do Google Agenda de hoje + tarefas que vencem hoje ou estão atrasadas.
- **Esta semana:** próximos eventos e tarefas por dia.
- **Financeiro em 4 números:** saldo em caixa, entradas do mês, saídas do mês, **runway** (meses).
- **Alertas:** contas a pagar vencendo em 7 dias, contas a receber atrasadas, tarefas atrasadas, integração do Google desconectada.
- Ações rápidas: nova tarefa, novo lançamento, novo evento.

### 4.2 Agenda (Google Agenda)
- Conectar a conta Google por **OAuth 2.0** (fluxo "Aplicativo da Web"), escopos mínimos:
  `https://www.googleapis.com/auth/calendar.readonly` e `https://www.googleapis.com/auth/calendar.events`.
- Cada usuário conecta a própria conta; o Admin pode definir uma **agenda da empresa** compartilhada.
- Escolher quais agendas sincronizar.
- **Sincronização incremental** com `syncToken` (tratar `410 Gone` refazendo a sincronização completa), a cada 5 min e no botão "Sincronizar agora". Guardar eventos em cache local para a tela abrir rápido.
- Visões dia, semana e mês; criar, editar e excluir evento na Rumo grava no Google.
- **Prazo de tarefa vira evento** (opcional por tarefa): cria evento "[Prazo] título da tarefa"; usar `extendedProperties.private.rumoTaskId` para não duplicar e para atualizar/remover quando a tarefa mudar.
- Tokens do Google **criptografados no banco** (AES-256-GCM, chave em `APP_ENCRYPTION_KEY`), refresh automático, botão "Desconectar" que revoga o token.
- Se a conexão cair, mostrar aviso claro e manter o cache somente leitura.

### 4.3 Tarefas e projetos ("o que fazer")
- Projetos com cor, responsável, status (ativo, pausado, concluído) e data-alvo.
- Tarefas: título, descrição, projeto, responsável, prioridade (alta, média, baixa), status (a fazer, fazendo, bloqueada, feita), prazo, estimativa em horas, etiquetas, subtarefas (checklist) e recorrência (diária, semanal, mensal).
- Visões: **Lista**, **Kanban** (arrastar entre status), **Calendário** e **Linha do tempo** (barra por projeto/tarefa entre início e prazo).
- Filtros salvos: "Minhas tarefas", "Atrasadas", "Esta semana", "Sem responsável".
- Visão **Hoje / Semana / 30 dias**, que junta tarefas com prazo e eventos da agenda, para cada pessoa ver o que tem que fazer no período.
- Metas trimestrais simples (OKR): objetivo, até 5 resultados-chave com valor atual/alvo e progresso em %, ligados a projetos.

### 4.4 Financeiro
- **Contas** (conta corrente, caixa, cartão), com saldo inicial.
- **Lançamentos:** tipo (entrada/saída), valor, data de competência, data de pagamento, status (previsto, pago/recebido, atrasado, cancelado), categoria, centro de custo, fornecedor/cliente, descrição, anexo de comprovante (PDF/imagem até 10 MB), recorrência mensal.
- **Contas a pagar e a receber** com vencimento e baixa ("marcar como pago").
- **Categorias** padrão editáveis: Receita de clientes, Investimento recebido, Folha, Impostos, Ferramentas/SaaS, Infraestrutura/Cloud, Marketing, Escritório, Jurídico/Contábil, Outros.
- **Importar extrato CSV** com prévia antes de gravar, mapeamento de colunas, detecção de duplicados e categorização sugerida por regras do usuário (ex.: descrição contém "AWS" → Infraestrutura).
- **Indicadores** (calcular no backend, com testes):
  - Saldo atual por conta e total.
  - **Burn rate** mensal = saídas pagas − entradas operacionais pagas no mês (excluir "Investimento recebido").
  - **Runway (meses)** = saldo total ÷ média do burn dos últimos 3 meses; se o burn for ≤ 0, mostrar "positivo".
  - Fluxo de caixa realizado × previsto por mês (gráfico de barras).
  - Despesas por categoria (gráfico) e evolução mensal.
  - **MRR** opcional: soma das entradas recorrentes da categoria "Receita de clientes".
- Relatórios mensais e por período, exportação **CSV** e **PDF**.
- Valores guardados em **centavos (inteiro)**; nunca usar float para dinheiro.

### 4.5 Configurações
- Usuários e papéis (Admin), integrações (Google), categorias e centros de custo, regras de categorização, fuso e moeda, auditoria (filtrar por usuário, data e tipo).

## 5. Modelo de dados (mínimo)

`users`, `sessions`, `audit_log`, `google_accounts` (tokens criptografados), `calendars`, `calendar_events` (cache, com `google_event_id`, `etag`, `updated`), `projects`, `tasks`, `task_checklist_items`, `task_tags`, `objectives`, `key_results`, `accounts`, `categories`, `cost_centers`, `counterparties`, `transactions`, `attachments`, `import_batches`, `categorization_rules`, `settings`.
Todas com `id` (UUID), `created_at`, `updated_at`; exclusão lógica (`deleted_at`) em tarefas, projetos e lançamentos.

## 6. API (REST, JSON, prefixo `/api`)

Sessão: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/mfa/*`.
Agenda: `GET /integrations/google/connect`, `GET /integrations/google/callback`, `POST /integrations/google/disconnect`, `GET /calendars`, `PATCH /calendars/:id`, `POST /calendar/sync`, `GET /events?from&to`, `POST /events`, `PATCH /events/:id`, `DELETE /events/:id`.
Tarefas: CRUD de `/projects`, `/tasks` (com `?view=today|week|30d&assignee=&status=`), `/objectives`, `/key-results`.
Financeiro: CRUD de `/accounts`, `/transactions`, `/categories`, `/cost-centers`; `POST /transactions/:id/settle`; `POST /imports/csv` (prévia) e `POST /imports/:id/commit`; `GET /finance/summary?month=`, `GET /finance/cashflow?from&to`, `GET /reports/*.csv|pdf`.
Painel: `GET /dashboard`.
Erros padronizados `{ error: { code, message, details? } }`; paginação por cursor nas listas.

## 7. Interface

- Visual limpo e profissional, claro e escuro, responsivo (celular, tablet, desktop), navegação lateral no desktop e barra inferior no celular.
- Fontes: Inter para texto; uma fonte de destaque para títulos (sugestão: "Space Grotesk").
- Datas `DD/MM/AAAA`, horas `HH:MM`, moeda `R$ 1.234,56`.
- Estados de carregando, vazio e erro em todas as telas; confirmação antes de excluir; acessibilidade (rótulos, foco visível, contraste AA, navegação por teclado).

## 8. Modo demonstração

- `npm run db:seed` cria uma startup fictícia ("Nébula Tech"): 6 usuários (1 Admin, 1 Financeiro, 4 Membros), 4 projetos, ~60 tarefas, 12 meses de lançamentos coerentes (folha, SaaS, cloud, receita recorrente crescendo, uma rodada de investimento), contas a pagar/receber e um OKR.
- Senhas do seed vêm de variáveis de ambiente; **nunca** deixar senha fixa no código.
- Sem Google conectado, a Agenda mostra eventos fictícios marcados como "demonstração".

## 9. Segurança e privacidade (obrigatório)

- Nenhuma chave, token ou segredo no frontend nem no repositório; tudo em `.env` (com `.env.example`).
- Validação Zod em toda rota; consultas parametrizadas pelo ORM; cabeçalhos de segurança (helmet), CORS restrito a `WEB_ORIGIN`, limite de taxa.
- Uploads: verificar tipo real do arquivo, limite de tamanho, guardar fora da pasta pública, servir com permissão checada.
- Logs sem dados sensíveis (sem tokens, sem senhas).
- LGPD: exportar e excluir dados de um usuário pelo Admin.

## 10. Testes e critérios de aceite

Escreva os testes junto com cada etapa. A etapa só está pronta quando:
- `npm run typecheck`, `npm run lint` e `npm test` passam sem erro.
- Testes unitários cobrem: burn rate, runway (incluindo burn ≤ 0), MRR, recorrências, importação CSV (duplicados), permissões por papel.
- Testes de API cobrem: login, acesso negado por papel (Membro não lê `/transactions`), CRUD de tarefas e lançamentos, sincronização do Google com `googleapis` **mockado** (incluindo `410` e token expirado).
- Playwright cobre: login → painel; criar tarefa com prazo → aparece em "Hoje/Semana"; lançar despesa → painel e runway atualizam; importar CSV com prévia.

## 11. Como trabalhar (etapas)

Faça **uma etapa por vez**, com commit ao fim de cada uma, e resuma no final da etapa o que foi feito, o que foi testado e o que ficou pendente. Não diga que algo funciona sem ter rodado o teste.

1. **Base:** monorepo, banco e migrações, autenticação, papéis, auditoria, layout e modo demonstração (seed).
2. **Tarefas e projetos:** CRUD, Kanban, lista, filtros, visão Hoje/Semana/30 dias, linha do tempo, OKR.
3. **Financeiro:** contas, lançamentos, a pagar/receber, categorias, indicadores (burn, runway, MRR), gráficos, relatórios CSV/PDF.
4. **Importação CSV** com prévia, duplicados e regras de categorização.
5. **Google Agenda:** OAuth, criptografia de tokens, sincronização incremental, CRUD de eventos, prazo de tarefa → evento.
6. **Painel e acabamento:** painel completo, alertas, modo escuro, acessibilidade, README.
7. **(Opcional, só se eu pedir depois) Assistente com IA:** perguntas em linguagem natural sobre tarefas, agenda e caixa, usando **ferramentas só de leitura**; qualquer ação que grave dados é apenas **proposta** e exige clique de aprovação humana; nunca envia mensagens.

## 12. README (entregar)

- Como rodar localmente, variáveis de ambiente, seed e testes.
- **Passo a passo do Google Cloud:** criar projeto, ativar a Google Calendar API, configurar a tela de consentimento, criar credencial OAuth "Aplicativo da Web", URI de redirecionamento `http://localhost:3001/api/integrations/google/callback` (e a de produção), colar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env`.
- Como publicar (Docker + PostgreSQL) e como fazer backup.
- Limitações conhecidas.
