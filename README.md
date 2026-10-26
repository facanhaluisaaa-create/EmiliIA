# emilIA — Sistema de Gestão do Espaço Psicológico Revisitare

Aplicação web privada para a gestão administrativa do consultório da psicóloga
Emília Sobral de Toledo Villena (CRP 06/203728), de uso interno da psicóloga e da
secretária Lígia.

> **Estado atual: Etapa 1 concluída** — identidade visual, navegação, autenticação
> e dashboard com dados fictícios. Nenhuma integração externa está conectada e
> nenhum dado real de paciente é utilizado.

## Visão geral

| Camada | Tecnologia |
| --- | --- |
| Frontend (`apps/web`) | React 18, TypeScript, Vite, Tailwind CSS, Radix UI (componentes acessíveis), lucide-react |
| Backend (`apps/api`) | Node.js 20+, Express, TypeScript, SQLite (better-sqlite3), zod |
| Autenticação | Sessões no servidor com cookie `httpOnly` + `SameSite=Strict`, senhas com bcrypt, MFA TOTP (aplicativo autenticador), limite de tentativas, verificação de origem (CSRF), auditoria |
| Dados sensíveis | Segredos MFA e registros clínicos criptografados com AES-256-GCM; acesso clínico restrito à psicóloga ou a autorização específica |

Todas as integrações externas (Google Sheets, Agenda, Drive, WhatsApp) passarão
pelo backend com credenciais protegidas por variáveis de ambiente. Elas estão
**previstas** para as Etapas 4 e 5 e aparecem na interface como "Não conectada".

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
      modules/       # dashboard, pacientes (leitura), configurações
  web/
    src/
      auth/          # contexto de autenticação e proteção de rotas
      components/ui/ # botões, inputs, cartões, badges, indicadores, marca
      layout/        # app shell (sidebar, barra superior, navegação móvel)
      pages/         # login, dashboard, configurações, módulos previstos
docs/preview/        # capturas de tela da Etapa 1
```

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
2. Etapa 2: cadastro de pacientes e agenda (diária, semanal, mensal, recorrências, conflitos).
3. Etapa 3: financeiro, documentos e relatórios (demonstrativos em PDF).
4. Etapa 4: integrações com Google Sheets (mapeamento, prévia e confirmação), Google Agenda/Meet e Google Drive.
5. Etapa 5: comunicação via API oficial do WhatsApp Business, sempre com autorização prévia.
6. Etapa 6: testes de segurança, permissões, sincronização e validação para produção.

## Avisos

- O sistema não deve ser publicado sem HTTPS, `NODE_ENV=production`, chave de criptografia própria e senhas trocadas.
- Notas fiscais oficiais não são emitidas sem integração homologada.
- Mensagens de WhatsApp nunca serão enviadas automaticamente sem configuração e autorização explícitas.
