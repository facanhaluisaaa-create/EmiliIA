# emilIA — Sistema de Gestão do Espaço Psicológico Revisitare

Aplicação web privada para a gestão administrativa do consultório da psicóloga
Emília Sobral de Toledo Villena (CRP 06/203728), de uso interno da psicóloga e da
secretária Lígia.

> **Estado atual: Etapas 1 a 6 implementadas.** Todos os módulos estão
> navegáveis e funcionais com dados fictícios. As integrações Google e WhatsApp
> estão implementadas e testadas contra APIs simuladas; o uso com credenciais
> reais depende da configuração descrita em `docs/PRODUCAO.md` e deve ser
> validado com dados de teste antes de qualquer dado real.

## Visão geral

| Camada | Tecnologia |
| --- | --- |
| Frontend (`apps/web`) | React 18, TypeScript, Vite, Tailwind CSS, Radix UI (componentes acessíveis), lucide-react |
| Backend (`apps/api`) | Node.js 20+, Express, TypeScript, SQLite (better-sqlite3), zod |
| Autenticação | Sessões no servidor com cookie `httpOnly` + `SameSite=Strict`, senhas com bcrypt, MFA TOTP (aplicativo autenticador), limite de tentativas, verificação de origem (CSRF), auditoria |
| Dados sensíveis | Segredos MFA, tokens Google e registros clínicos criptografados com AES-256-GCM; acesso clínico restrito à psicóloga ou a autorização específica, com prazo e motivo |
| Integrações | Google Sheets, Agenda/Meet e Drive via OAuth 2.0 no servidor; WhatsApp Business Cloud API com envio manual e confirmado |
| Produção | Frontend servido pela própria API, Dockerfile, checklist em `docs/PRODUCAO.md` |

Todas as integrações externas passam pelo backend com credenciais em variáveis
de ambiente. Sem credenciais configuradas elas aparecem como "Não conectada" e
nada é sincronizado nem enviado.

## Como colocar no ar (sem conhecimento técnico)

1. Crie uma conta gratuita em [render.com](https://render.com).
2. Clique em **New +** → **Blueprint**, conecte este repositório no GitHub e escolha o branch `etapa-1-fundacao`.
3. Confirme. Em alguns minutos o Render entrega um endereço `https://emiliia-xxxx.onrender.com`.
4. No painel do Render, abra **Environment** e copie os valores gerados de `SEED_PASSWORD_EMILIA` e `SEED_PASSWORD_LIGIA`: são as senhas iniciais das contas `emilia@emiliia.local` e `ligia@emiliia.local`.
5. Entre, troque as senhas em Configurações → Segurança e ative a verificação em duas etapas.

O arquivo `render.yaml` já define tudo: HTTPS, disco persistente para o banco e os uploads, chave de criptografia e fuso horário. Depois, para ligar Google e WhatsApp, acrescente as variáveis descritas em "Integrações" na mesma tela **Environment**.

## Como executar

Pré-requisitos: Node.js 20 ou superior e npm.

```bash
npm install
npm run dev
```

- Interface: http://localhost:5173
- API: http://localhost:3001/api/health

Na primeira execução o banco SQLite (`apps/api/data/emiliia.db`) é criado e
preenchido com dados fictícios de demonstração.

### Contas de demonstração

| Usuária | E-mail | Perfil |
| --- | --- | --- |
| Emília | `emilia@emiliia.local` | Psicóloga responsável (acesso total, incluindo área clínica) |
| Lígia | `ligia@emiliia.local` | Secretaria administrativa (módulos administrativos; área clínica apenas com autorização) |

As senhas iniciais vêm das variáveis `SEED_PASSWORD_EMILIA` e `SEED_PASSWORD_LIGIA`
em `apps/api/.env`. Sem elas, o seed de desenvolvimento usa `emilia-demo-2026` e
`ligia-demo-2026`. **Troque-as antes de qualquer uso fora do ambiente local.**

Para recriar os dados de demonstração:

```bash
npm run db:seed -w apps/api -- --reset
```

### Variáveis de ambiente

Copie `apps/api/.env.example` para `apps/api/.env`. Em produção são obrigatórias
`APP_ENCRYPTION_KEY` (32 bytes em hexadecimal) e `NODE_ENV=production`; em
desenvolvimento uma chave local é gerada em `apps/api/data/.dev-encryption-key`.

### Verificações

```bash
npm run typecheck   # TypeScript em ambos os apps
npm test            # testes de autenticação, CSRF, permissões e MFA (API)
npm run build       # build de produção
```

## Estrutura

```
apps/
  api/
    src/
      auth/          # senha, sessão, MFA, permissões, middleware, rotas
      audit/         # registro de auditoria
      db/            # schema.sql, conexão, seed fictício
      middleware/    # helmet, CSRF por origem, erros
      integrations/  # cliente Google (OAuth), Sheets, Calendar, Drive, WhatsApp
      modules/       # dashboard, pacientes, agenda, financeiro, documentos, relatórios, comunicação, configurações
  web/
    src/
      auth/          # contexto de autenticação e proteção de rotas
      components/ui/ # botões, inputs, cartões, badges, indicadores, marca
      layout/        # app shell (sidebar, barra superior, navegação móvel)
      features/      # pacientes, agenda, financeiro, documentos, relatórios, comunicação, integrações, usuários
      pages/         # login, dashboard, configurações, módulos previstos
docs/preview/        # capturas de tela da Etapa 1
```

## Pacientes e agenda (Etapa 2)

- **Duplicidade:** ao digitar nome, telefone ou e-mail o sistema consulta cadastros semelhantes em tempo real; ao salvar, um cadastro semelhante exige confirmação explícita.
- **Conflitos:** cada consulta (e cada ocorrência de uma série) é verificada contra sobreposição de horário com consultas não canceladas. Nada é salvo se houver conflito.
- **Cancelamento:** consultas nunca são apagadas; recebem o status "cancelada". Em séries, é possível cancelar "esta e as próximas".
- **Google Agenda / Meet:** campos `google_event_id` e `meet_url` já existem; a sincronização será conectada na Etapa 4.

## Permissões

| Permissão | Psicóloga | Secretaria |
| --- | --- | --- |
| Dashboard, pacientes, agenda, financeiro, documentos, comunicação, relatórios | ✔ | ✔ |
| Configurações (leitura) e auditoria | ✔ | ✔ |
| Gerenciar usuários e integrações | ✔ | — |
| Informações clínicas (prontuários, notas de sessão, protocolos, documentos sigilosos) | ✔ | Somente com autorização específica registrada (`clinical_access_grants`) |

A verificação é feita **no backend** em todas as rotas; a interface apenas oculta
o que o perfil não pode acessar.

## Identidade visual

- Verde profundo `#1D2924` · Verde-sálvia `#A9B8A3` · Off-white `#F5F5F0` · Branco `#FFFFFF` · Cinza `#65776C`
- Tipografia: Cormorant Garamond (títulos) e Inter (texto)
- A marca "emilIA" é tipográfica e provisória: substitua o componente
  `apps/web/src/components/ui/Logo.tsx` pelo logotipo oficial quando disponível.

## Roteiro

1. **Etapa 1 — concluída:** identidade visual, navegação, autenticação (senha + MFA), dashboard com dados fictícios, configurações de segurança e auditoria.
2. **Etapa 2 — concluída:** cadastro de pacientes (responsável financeiro, contato de emergência, detecção de duplicidade, histórico administrativo) e agenda com visões diária, semanal e mensal, consultas únicas/semanais/quinzenais, verificação de conflitos e cancelamento de séries.
3. **Etapa 3 — concluída:** cobranças por competência com geração mensal a partir das sessões realizadas, pagamentos parciais/integrais, comprovantes e notas vinculados, demonstrativo em PDF; documentos por paciente e mês (upload local ou link); relatórios com filtros e exportação CSV/PDF.
4. **Etapa 4 — concluída:** conta Google única (OAuth no servidor). Sheets: leitura da estrutura, mapeamento sugerido, prévia classificada, confirmação explícita, identificadores estáveis por linha, conflitos e envio de volta preservando fórmulas. Agenda: eventos com Meet e títulos com iniciais. Drive: espelhamento em `emilIA/Paciente/Mês`.
5. **Etapa 5 — concluída:** modelos com variáveis, pré-visualização, sugestões, envio manual com confirmação, habilitação restrita à psicóloga, histórico e webhook de status. Sem envio automático.
6. **Etapa 6 — concluída:** gestão de contas (senha temporária com troca obrigatória, desativação, redefinição), autorizações de acesso clínico por paciente/prazo com revogação, limite global de requisições, dependências atualizadas, frontend servido pela API em produção, Dockerfile e checklist.

## Integrações: como conectar

1. **Google:** crie um cliente OAuth 2.0 "Aplicativo da Web" no Google Cloud com as APIs Sheets, Calendar e Drive habilitadas e a URL de redirecionamento `<API_PUBLIC_URL>/api/integrations/google/callback`. Defina `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` e use "Conectar conta Google" em Configurações → Integrações. O assistente de planilha fica em Configurações → Integrações → Google Sheets.
2. **WhatsApp:** defina `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_VERIFY_TOKEN` (Cloud API da Meta), aponte o webhook para `/api/communication/whatsapp/webhook` e habilite o envio em Comunicação (apenas a psicóloga).

As integrações foram validadas com APIs simuladas nos testes automatizados. O primeiro uso com credenciais reais deve ser feito com dados de teste.

## Produção

Veja `docs/PRODUCAO.md` (checklist completo) e o `Dockerfile`. Em resumo:
`NODE_ENV=production`, HTTPS por proxy reverso, `APP_ENCRYPTION_KEY` própria,
`WEB_ORIGIN`/`API_PUBLIC_URL` com o domínio público, volume persistente em
`DATABASE_PATH` e `SEED_DEMO=false` para iniciar sem dados fictícios.

## Avisos

- O sistema não deve ser publicado sem HTTPS, `NODE_ENV=production`, chave de criptografia própria e senhas trocadas.
- Notas fiscais oficiais não são emitidas sem integração homologada.
- Mensagens de WhatsApp nunca serão enviadas automaticamente sem configuração e autorização explícitas.
