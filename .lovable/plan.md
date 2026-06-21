# Fase 1 — Fundamentos do Viajaly

Antes de gerar código, abaixo está exatamente o que vou criar. **Aguardo seu "ok"** para implementar.

> **Premissas (confirme se ok)**
> - **Lovable Cloud** (Supabase gerenciado) como backend — não citado pelo nome ao usuário final.
> - **Instância única Viajaly** (tabela `agencies` já fica criada para preparar multi-tenant, mas com 1 linha seed).
> - O **portal do cliente** roda em React Router DOM dentro do `PhoneFrame` 392×812 (mobile-first), conforme `02 Estrutura`. **Não vou portar o runtime dos protótipos** — só uso como referência visual.

---

## (a) Schema Supabase — tabelas, enums, RLS

### Enums
```
app_role           : 'admin' | 'client'
proposal_status_t  : 'draft' | 'sent' | 'accepted'
payment_method_t   : 'pix' | 'card'
payment_status_t   : 'pending' | 'processing' | 'declined' | 'paid'
tax_status_t       : 'pending' | 'paid'
doc_kind_t         : 'pass' | 'foto' | 'renda' | 'vinc' | 'ds160' | 'outro'
doc_status_t       : 'locked' | 'pending' | 'received' | 'approved' | 'rejected'
ds160_status_t     : 'draft' | 'received' | 'validated'
sched_service_t    : 'casv' | 'entrevista' | 'pf'
sched_status_t     : 'open' | 'sent' | 'confirmed'
product_key_t      : 'vistos' | 'pass' | 'rot' | 'mil'
per_t              : 'person' | 'group'
visto_plan_t       : 'start' | 'pro' | 'prem'
contract_status_t  : 'draft' | 'sent' | 'signed'
msg_from_t         : 'client' | 'consultant'
```

### Tabelas (resumido — colunas e FKs)

| Tabela | Colunas-chave |
|---|---|
| `agencies` | id, name, created_at |
| `profiles` | id (=auth.users.id), role app_role, name, agency_id → agencies, created_at |
| `requests` | id, agency_id, lead_name, lead_email, lead_phone, **access_code (6 díg., único por agência)**, combo_pct (default 10), proposal_status, contract_signed, sign_name, signed_at, payment_method, payment_status, tax_status, usd_rate, usd_as_of, usd_source, sched_window_open, created_by, created_at |
| `travelers` | id, request_id, name, is_lead, has_vistos, has_pass |
| `request_group` | request_id (PK), has_rot, has_mil |
| `documents` | id, traveler_id, kind doc_kind_t, name, required, status doc_status_t, file_url, reject_reason, version, uploaded_at, reviewed_by |
| `ds160_submission` | traveler_id (PK), form jsonb, completion_pct, status ds160_status_t, package jsonb, submitted_at |
| `schedule_intents` | id, traveler_id, service, wish, status, confirmed_date, confirmed_by |
| `schedule_window` | agency_id (PK), released_quinzenas jsonb, slots jsonb |
| `products_catalog` | key product_key_t PK, name, tier, price, tagline, descr, per per_t, active, color, tint |
| `visto_plans` | key visto_plan_t PK, label, price, descr |
| `contracts` | id, request_id, client, product, template, status contract_status_t, pdf_url |
| `messages` | id, request_id, from msg_from_t, text, created_at |
| `notifications` | id, request_id, kind, title, body, read, created_at |
| `milhas_consult` | id, request_id, status, saida, destino, cabine, programa, saldo, obs, plano, alertas jsonb, anexos jsonb |
| `roteiros` | id, request_id, trip, version, status, nota, anexos jsonb |
| `atendimentos` | id, agency_id, who, date, channel, origin |
| `audit_log` | id, actor, action, target, payload jsonb, at |
| `access_code_attempts` | id, request_id, ip, at, success — para **rate-limit do login do cliente** |

**Triggers/funções:**
- `handle_new_user()` → cria `profiles` com `role='client'` por padrão.
- `create_traveler_defaults()` → trigger `AFTER INSERT ON travelers` cria os **docs padrão** (`pass`, `foto`, `renda`, `vinc` em `pending` + `ds160` em `locked`), atendendo seu ponto **#2**.
- `compute_journey_steps(request_id)` → função SQL `STABLE` que devolve as 7 etapas com status `done|active|locked`, derivada **apenas dos campos de `requests` / `documents` / `schedule_intents`** — verdade derivada no servidor (seu ponto **#5**). O front consome via RPC e via Realtime; nada de "campo solto de etapa atual" que possa dessincronizar.
- `has_role(uid, role)` security-definer (padrão Lovable).
- `is_request_member(request_id)` security-definer: true se o usuário é admin **da mesma agência** OU é o cliente cujo e-mail bate com `requests.lead_email`.

### RLS — política por papel (toda tabela com RLS habilitado)

| Tabela | `admin` (mesma agência) | `client` (dono da requisição) | `anon` |
|---|---|---|---|
| agencies | SELECT própria | — | — |
| profiles | SELECT/UPDATE da agência | SELECT/UPDATE próprio | — |
| requests | ALL where agency_id = sua | SELECT/UPDATE limitado (campos comerciais) where lead_email = auth.email() | — |
| travelers, request_group, documents, ds160_submission, schedule_intents, messages, notifications, contracts, milhas_consult, roteiros | ALL via `is_request_member` | SELECT + UPDATE limitado idem | — |
| products_catalog, visto_plans | ALL admin | SELECT autenticado | — |
| schedule_window, atendimentos, audit_log | ALL admin | — | — |
| access_code_attempts | INSERT anon (login), SELECT admin | — | INSERT |

**GRANTs explícitos** em toda tabela `public.*` para `authenticated` e `service_role` (e `anon` só onde precisa). RLS é a única camada de isolamento — sem checagem de autorização no front fingindo de RLS (seu ponto **#4**).

### Seeds (na migration)
- 1 linha em `agencies` (“Viajaly”).
- `products_catalog`: **vistos 1890 / pass 390 / rot 1200 / mil 690** (cores, tints, `per`, taglines do `CATALOG`).
- `visto_plans`: **start 990 / pro 1890 (default) / prem 2790**.
- Atende seu ponto **#1** — Proposta nunca nasce vazia.

---

## (b) Árvore de pastas e rotas

### Rotas
```
/                        → redirect por papel (admin → /console, client → /portal, anon → /portal/login)
/portal/login            público (código 6 díg. OU magic link)
/portal                  guard cliente: Home (jornada + Seus produtos)
/portal/proposta
/portal/contrato
/portal/pagamento        bloqueado até contract_signed
/portal/documentos
/portal/taxas
/portal/agenda
/portal/mensagens
/portal/notificacoes
/portal/ds160/:travId    wizard DS-160 dentro do app
/portal/onboarding/:kind pass | rot | mil
/portal/produto/:key
/portal/conclusao

/console/login           público (Supabase Auth e-mail/senha)
/console                 guard admin: Pipeline (tabela|kanban)
/console/cliente/:id     Cliente 360º
/console/orcamento/novo  Wizard 3 passos
/console/documentos
/console/agenda
/console/produtos
/console/financeiro
/console/milhas
/console/roteiros
```

### Pastas (mesma da §1.2 do `02 Estrutura`)
```
src/
  main.tsx  App.tsx  routes.tsx
  lib/        supabase.ts  format.ts  validators.ts  constants.ts
  types/      db.ts (gerado)
  theme/      tokens.ts  globals.css
  components/ui/         (shadcn)
  components/viajaly/    Logo, StatusPill, StepCard, ProductCard, ProgressBar,
                         Toast, UploadSlot, ChecklistItem, Chips, MultiChips,
                         PhoneFrame, Disclaimer
  features/   auth, journey, proposal, contract, payment, documents,
              ds160, onboarding, scheduling, messages, notifications,
              travelers, admin
  hooks/      useRealtimeRequest, useToast, useAutosave
  guards/     RequireClient, RequireAdmin
```

Cada `features/<x>` segue `{api.ts, hooks.ts, components/, pages/, schema.ts}`.

---

## (c) Fluxos de autenticação

### Cliente (`/portal/login`) — duas vias
1. **Código de 6 dígitos**
   - Tela: e-mail + 6 dígitos.
   - Server fn `loginWithCode({email, code})`:
     - Registra tentativa em `access_code_attempts`.
     - **Rate-limit**: máx **5 tentativas / 15 min por IP+email**; após exceder → bloqueio 30 min, mensagem genérica.
     - Valida `requests.access_code` + `lead_email` (case-insensitive).
     - Em sucesso, gera **OTP de uso único** via `supabase.auth.admin.generateLink({type: 'magiclink'})` e troca por sessão (o código de 6 díg. **não é credencial** sozinho — atende seu ponto **#3**).
     - Invalida o código após o uso (rotação opcional: novo código a cada login).
2. **Magic link** por e-mail (`supabase.auth.signInWithOtp`, `emailRedirectTo: origin + '/portal'`).

Saída: sessão Supabase válida + `profiles.role='client'`. O guard `RequireClient` chama `getUser()` (revalida) e busca a `request` ativa pelo `lead_email`.

### Admin (`/console/login`)
- Supabase Auth **e-mail + senha**.
- `profiles.role` precisa ser `'admin'`; senão → 403.
- Guard `RequireAdmin` idem (`getUser()` + checagem de role via `has_role`).
- Sem auto-cadastro: admins criados via migration seed + convite (Auth Admin API em server fn protegida).

### Estado único cliente ↔ admin
- Hook `useRealtimeRequest(requestId)`:
  - `supabase.channel('request:'+id)` escuta `requests`, `documents`, `schedule_intents`, `messages`, `notifications`.
  - Invalida queries TanStack on change.
- `useJourney(requestId)` chama RPC `compute_journey_steps` (verdade no servidor).

---

## Critério de pronto da Fase 1
1. **Recarregar não perde estado** — toda informação vive no Postgres; nada em memória/localStorage além de cache de UI.
2. **Admin vê o mesmo que o cliente em tempo real** — alterar `proposal_status` no `/console/cliente/:id` reflete no `/portal` em < 2s (Realtime).
3. Login do cliente com código respeita o rate-limit + uso único.
4. RLS impede que cliente A leia/escreva dados do cliente B (testar com 2 contas).
5. `compute_journey_steps` devolve as 7 etapas com `done|active|locked` corretos para um estado seed.

---

## O que faço quando você disser "ok"
1. Habilitar **Lovable Cloud**.
2. Criar a migration completa (enums, tabelas, GRANTs, RLS, triggers, função `compute_journey_steps`, seeds).
3. Gerar `types/db.ts`.
4. Setar tema Tailwind + tokens (`navy/coral/teal/cream/app-bg/ink…`, fontes Sora+Inter) e os componentes-base de `components/viajaly/` (Logo, PhoneFrame, StatusPill, StepCard, Toast).
5. Implementar `RequireClient`/`RequireAdmin`, `/portal/login` (código + magic link, com rate-limit), `/console/login`.
6. Implementar `useRealtimeRequest` + `useJourney` + uma **Home `/portal`** mínima que renderiza as 7 etapas a partir do RPC + um **`/console/cliente/:id`** que muda status (smoke test do realtime).
7. Não avanço para Fase 2 (Catálogo & Orçamento) sem seu sinal verde.

Confirma o plano? Algo a ajustar antes de eu começar?
