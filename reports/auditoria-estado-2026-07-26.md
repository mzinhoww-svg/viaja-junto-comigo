# Auditoria profunda de estado — Viajaly Trip

**Data:** 2026-07-26 · **Escopo:** três camadas independentes (repositório, banco, produção)
**Regra aplicada:** nada afirmado por leitura de código, por memória ou pelo que o `VIAJALY-TRIP.md` diz. Cada linha abaixo declara a camada e o método da evidência. Onde não consegui verificar, está escrito **"não verificado"** e o porquê.

**Nada foi corrigido, nenhum código foi tocado, nenhum PR foi mergeado.** Este arquivo é o único produto.

---

## Sumário executivo — 6 fatos que mudam a leitura do projeto

1. **Produção está ~19h atrás da `main`, e a publicação não é automática.** O build no ar é da `main` em `e268aca`/`8a6438c` (25/07, 20:19–20:27Z). Cinco merges posteriores não estão no ar. A Seção 3 afirma "Vercel… todo PR mergeado na main publica sozinho" — **as duas metades da frase estão erradas** (ver §3.1).
2. **O produto vendido separado não tem porta de entrada em produção.** `GET /trip/login` → **404**. Quem entra em `/trip` sem sessão é redirecionado para `/portal/login`. Exatamente o beco sem saída que o VJT-011d resolveu — e que não está publicado.
3. **O banco está 100% aplicado, incluindo a migration que o documento chama de pendente.** Não há migration pendente. Verifiquei por conexão direta (§2).
4. **O banco está vazio: 0 viagens, 0 entitlements, 0 consentimentos, 0 mensagens de IA.** Nenhum usuário real ainda. Isso reduz o dano corrente de várias pendências e é a razão de o custo de arrumá-las ser mínimo agora.
5. **Três coisas estão no ar sem efeito:** Sentry (sem DSN, SDK nem existe no bundle), PostHog (sem chave, 0 eventos), Stripe (`pk_test_`, não cobra).
6. **Exclusão de conta está quebrada:** a Edge Function `delete-account` responde **404**. O botão existe no bundle publicado.

**Nenhuma chave sensível vaza.** Varredura completa dos 92 chunks: §3.5.

---

# CAMADA 1 — REPOSITÓRIO (API do GitHub, não cache)

**Método:** `list_pull_requests` (open + closed, 52 PRs), `list_issues` (open + closed, 29 issues), `list_branches`, `list_commits`, `actions_list`. Estado de merge determinado **exclusivamente por `merged_at`**.

> ⚠️ **A ressalva do pedido se confirmou.** No retorno de `list_pull_requests` o campo `merged` vem **`false` para todos os 48 PRs fechados**, inclusive os 46 comprovadamente mergeados. Quem ler esse campo conclui que nada foi mergeado. Todo veredito abaixo usa `merged_at`.

## 1.1 Ticket a ticket (Seção 7)

| Ticket | Issue | PR | `merged_at` (UTC) | Veredito |
|---|---|---|---|---|
| VJT-001 | #10 | #11 | 2026-07-24T12:20:12Z | Mergeado |
| VJT-002 | #12 | #15 | 2026-07-24T13:49:10Z | Mergeado |
| VJT-003 | #16 + **#17 (duplicada)** | **#18 fechada sem merge**, #19 | 2026-07-24T16:51:49Z | Mergeado (via #19) |
| VJT-003b | #21 | #24 | 2026-07-24T20:28:02Z | Mergeado |
| VJT-003c | #20 | #23 | 2026-07-24T20:27:57Z | Mergeado |
| VJT-004 | #22 | #25 | 2026-07-24T20:28:08Z | Mergeado |
| VJT-004b | #26 | #27 | 2026-07-24T21:41:42Z | Mergeado |
| VJT-005 | #29 | #31 | 2026-07-24T21:42:40Z | Mergeado |
| VJT-006 | #32 | #33 | 2026-07-24T23:09:50Z | Mergeado |
| VJT-006b | **#36 e #37 (duas)** | **#38 e #40 (dois, ambos mergeados)** | 00:12:35Z e 00:13:37Z | Mergeado **em duplicidade** |
| VJT-007 | #35 | #39 | 2026-07-25T00:13:18Z | Mergeado |
| VJT-007b | #45 | #47 | 2026-07-25T14:08:16Z | Mergeado |
| VJT-008 | #13 | #14 | 2026-07-24T13:15:39Z | Mergeado |
| VJT-009 | #48 | #49 | 2026-07-25T13:55:11Z | Mergeado |
| VJT-010 | #28 | #30 | 2026-07-24T21:41:48Z | Mergeado |
| VJT-011 | #50 | #51 | 2026-07-25T15:39:36Z | Mergeado |
| VJT-011b | #73 | #75 | 2026-07-25T22:02:36Z | Mergeado · follow-up **#76/#77 aberto** |
| VJT-011c | **nenhuma** | #72 | 2026-07-25T22:03:17Z | Mergeado **sem issue** |
| VJT-011d | **nenhuma** | #72 (mesmo PR) | 2026-07-25T22:03:17Z | Mergeado **sem issue** |
| VJT-012 | #54 | #55 | 2026-07-25T17:22:20Z | Mergeado |
| VJT-013 | #58 | #59 (+#64 follow-up) | 17:21:55Z (+22:04:09Z) | Mergeado |
| VJT-014 | #60 | #61 (+#63 troca de provider) | 17:05:31Z (+18:58:18Z) | Mergeado |
| VJT-015 | #66 | #68 (+#70 conserto) | 19:58:15Z (+20:06:26Z) | **Mergeado** |
| VJT-016 | #52 | #53 | 2026-07-25T16:40:54Z | Mergeado |
| VJT-017 | #56 | #57 | 2026-07-25T17:22:06Z | Mergeado |
| VJT-017b | #65 | #67 | 2026-07-25T19:57:33Z | Mergeado |
| VJT-018 | **#80 aberta** | **#81 aberto (draft)** | — | **Não mergeado** |
| VJT-019 | **#78 aberta** | **#79 aberto (draft)** | — | **Não mergeado** |

**Totais:** 52 PRs — 46 mergeados, 2 fechados sem merge (#18, #43), 4 abertos. 29 issues — 26 fechadas, 3 abertas.

**Desvios de processo encontrados:**
- **VJT-011c e VJT-011d não têm issue.** O passo 3 da Seção 6 exige issue antes do código. Os dois entraram por um PR só (#72), sem rastro de issue.
- **VJT-006b foi implementado e mergeado duas vezes** (issues #36 e #37, PRs #38 e #40, mergeados com 62 segundos de diferença). A checagem de duplicata da Seção 6 falhou e o trabalho duplicado **entrou na main**, não foi barrado.
- **VJT-003** gerou issue duplicada (#16/#17) e um PR descartado (#18).

## 1.2 PRs abertos (agora: 2026-07-26 ~17:40Z)

| PR | Título | Aberto há | Draft | O que é / estado |
|---|---|---|---|---|
| **#71** | `test: acompanha a migração do assistente de IA para createServerFn` | **~21h** | não | **OBSOLETO** — ver §1.4 |
| **#77** | VJT-011b-1 — runbook de ativação de Premium | ~19h | sim | Doc + 1 teste. Fecha #76 |
| **#79** | VJT-019 — auditoria final do milestone | ~19h | sim | Só markdown (Seção 0 + Log) |
| **#81** | VJT-018 — QA mobile e performance | ~17,5h | sim | QA + polimento; **é a DoD do milestone** |

**Nenhum dos quatro tem review humana registrada.** Três são draft — não sinalizam pedido de merge. **#71 não é draft e está parado há 21h.**

## 1.3 Issues abertas

| Issue | Aberta há | O que é |
|---|---|---|
| #80 | ~17,5h | VJT-018 QA mobile (DoD do milestone) |
| #78 | ~19h | VJT-019 auditoria final |
| #76 | ~19h | VJT-011b follow-up: runbook desatualizado |

## 1.4 PRs obsoletos

**PR #71 — obsoleto, confirmado por verificação independente** (não aceitei a alegação do PR #79 de segunda mão).
Ele conserta `src/hooks/trip-analytics-events.test.tsx`, que mockava `supabase.functions.invoke("ai-chat")` depois de o assistente migrar para `createServerFn`. Comparei o arquivo na `origin/main` atual:

```
src/hooks/trip-analytics-events.test.tsx na origin/main:
  ocorrências de "ai-chat.functions"  → 1   (transporte novo, já mockado)
  ocorrências de "functions.invoke"   → 0   (transporte antigo, já removido)
```

O conserto entrou na `main` por outro caminho (merge de `main` na branch do VJT-011c/011d, commit `3ec1e51`, PR #72). **#71 pode ser fechado sem perda.**

Nenhum outro PR aberto está obsoleto: #77, #79 e #81 têm conteúdo que não está na `main`.

## 1.5 Branches órfãs

**38 branches no remoto; apenas `main` é ativa.** As outras 37 pertencem a PRs já mergeados ou fechados e nunca foram apagadas — incluindo `claude/vjt-003-onboarding-wizard`, a do PR #18 descartado, que a Seção 0 já registra como pendente de exclusão manual.

Branches de tickets **mergeados** que continuam de pé (amostra): `claude/vjt-001`, `claude/vjt-002-trip-math-tests-3oapkz`, `claude/vjt-003-wizard-onboarding`, `claude/vjt-003b-premium-catalog-xhtkr8`, `claude/vjt-003c-date-validation-b46z17`, `claude/vjt-004-dashboard-sua-jornada-uyy99a`, `claude/vjt-004b-marcos-shared`, `claude/vjt-005-economia-mensal-tzc0s9`, `claude/vjt-006-budget-tabs-12q354`, `claude/vjt-006b-*` (duas), `claude/vjt-007-checklists-ui`, `claude/vjt-008-roteiro-7qdvqq`, `claude/vjt-009-visto-contextual-7q2n2e`, `claude/vjt-010-export-pdf-tct5t9`, `claude/vjt-011b-implementation-n8w5vr`, `claude/vjt-013-invites-members-4279qz`, `claude/vjt-014-ia-assistant-4q9apf`, `claude/vjt-017-lgpd-trip-complete-3ovqvq`, `claude/optimistic-bohr-ej5h70` (VJT-011), `claude/stripe-checkout-webhook-vjt-012-5ne0m6` (VJT-012), `claude/travel-app-access-link-t4ig4u` (VJT-011c/d), `claude/consent-terms-versioning-wcrqqk` (VJT-017b), `claude/pwa-viajaly-trip-vjt-016-7xliir` (VJT-016).

Dano: baixo, mas ruído real — a lista de branches deixou de ser um sinal de trabalho em curso.

## 1.6 CI

`main` HEAD `8ed7fc7`: **verde**. Mas o histórico recente tem **merges com CI vermelho**:

| Commit | O quê | CI |
|---|---|---|
| `8ed7fc7` | PR #64 | ✅ success |
| `7552718` | PR #72 (VJT-011c/d) | ✅ success |
| `e8565f3` | PR #74 | ❌ **failure** |
| `826f512` | PR #75 (VJT-011b) | ❌ **failure** |
| `69a004e` | "Adicionou botão Google" (Lovable, direto na main) | ❌ **failure** |
| `8a6438c` | PR #69 | ❌ **failure** |
| `e268aca` | "Migrou AI para createServerFn" (Lovable, direto na main) | ❌ **failure** |
| `13443dd`, `c70fe5c` | Lovable, direto na main | ❌ **failure** |
| `5d0f436` | PR #68 (VJT-015) | ❌ **failure** |

Dois padrões: (a) o editor Lovable empurra **direto para a `main`, sem PR e sem gate de CI**; (b) PRs foram mergeados com o check vermelho. **O build que está no ar hoje veio de um commit com CI vermelho** (`e268aca`/`8a6438c`).

---

# CAMADA 2 — BANCO DE DADOS

## 2.1 O acesso existe — ao contrário do que o documento afirma

O `VIAJALY-TRIP.md` diz, em três lugares, que o projeto `urrlqljlibpzaqnemlwf` é inalcançável por conector e que migrations precisam de aplicação manual no SQL Editor.

**Isso não é mais verdade nesta sessão.** O conector **Lovable** desta conta alcança o banco e executa SQL. O `project_id` do Lovable (`a357c84b-f9f7-4cb0-8d4e-a9798a04ecbd`) está publicado no próprio HTML de produção, no badge do rodapé. Tudo abaixo é resultado de query executada, não inferência.

> É verdade que o conector **Supabase** não enxerga esse projeto (ele lista só `crm-ai-studio`, `supabase-purple-book`, `the-loyalty`). O documento generalizou de "o conector Supabase não alcança" para "não é verificável" — e o caminho pelo Lovable existia.

**Portanto não entrego bloco de SQL para você rodar: já rodei.**

## 2.2 Estrutura — `item | esperado | encontrado | veredito`

| Item | Esperado | Encontrado | Veredito |
|---|---|---|---|
| 19 tabelas do produto | todas existem | todas as 19 existem | ✅ |
| `paises_visto` (VJT-001) | 14 | **14** | ✅ |
| `checklist_templates` (VJT-003b) | 142 | **142** | ✅ |
| `checklist_templates` tier premium | 80–120 aplicáveis | **112** no catálogo | ✅ |
| `trips.num_criancas` (VJT-003) | existe | existe | ✅ |
| `entitlements` em `supabase_realtime` (VJT-011) | presente | presente | ✅ |
| `idx_entitlements_stripe_payment_id` (VJT-012) | existe | existe | ✅ |
| `is_trip_member()` (VJT-001) | existe | existe | ✅ |
| `trip_owner_id()` (VJT-013) | existe | existe | ✅ |
| `accept_trip_invite()` (VJT-013) | existe | existe | ✅ |
| `increment_ai_usage()` (VJT-014) | existe | existe | ✅ |
| `ai_daily_message_count()` (VJT-014) | existe | existe | ✅ |
| `savings_entries.created_by` (VJT-017) | nullable | nullable | ✅ |
| `trip_nps_responses` (VJT-017) | existe | existe | ✅ |
| `user_lgpd_consents` (VJT-017) | existe | existe | ✅ |
| **`user_lgpd_consents.id` (VJT-017b)** | existe | **existe** | ✅ |
| **`user_lgpd_consents` PK** | `id` (não `user_id`) | **`id`** | ✅ |
| **unique `(user_id, versao_termos)` (VJT-017b)** | existe | `user_lgpd_consents_user_versao_unique` | ✅ |
| `trip_invites.token` | `encode(gen_random_bytes(24),'hex')` | idem | ✅ |
| `trip_invites.expires_at` | `now() + 7 days` | `(now() + '7 days'::interval)` | ✅ |
| Valores monetários em centavos | colunas `*_cents` | **21 colunas** | ✅ |

**Conclusão: não existe migration pendente.** Incluindo `20260725220000_vjt017b_lgpd_consent_history.sql`, que a Seção 0 declara como "única pendente de aplicação" — **ela está aplicada** (a coluna `id` e o unique só existem nela).

## 2.3 RLS — 19/19 tabelas

| Tabela | RLS | Policies |
|---|---|---|
| trips | **ON** | 4 |
| trip_members | **ON** | 3 |
| trip_invites | **ON** | 3 |
| trip_nps_responses | **ON** | 3 |
| user_lgpd_consents | **ON** | 2 |
| ai_conversations, ai_messages, ai_usage, audit_log, budget_categories, budget_items, checklist_items, checklists, checklist_templates, entitlements, itinerary_days, itinerary_slots, paises_visto, savings_entries | **ON** | 1 cada |

Nenhuma tabela com RLS desabilitada. `entitlements` tem 1 policy só (leitura própria) — coerente com a decisão de que toda escrita é service role no servidor.

> **Não verificado:** o *conteúdo* de cada policy (se a expressão realmente restringe o que promete) e o resultado de `scripts/test-rls.sh --audit`. Verifiquei que RLS está ligada e quantas policies existem, não a semântica de cada uma. Isso exige sessão autenticada de dois usuários distintos, que não montei nesta sessão.

## 2.4 Dados — o banco está vazio

| Tabela | Linhas |
|---|---|
| `trips` | **0** |
| `entitlements` | **0** (0 premium) |
| `user_lgpd_consents` | **0** |
| `ai_messages` | **0** |
| `trip_nps_responses` | **0** |

**Nenhum usuário real usou o produto ainda.** Isso é o dado que mais muda a priorização: quase toda pendência abaixo custa quase nada para consertar agora e fica cara depois.

---

# CAMADA 3 — PRODUÇÃO (o que está de fato no ar)

**Método:** 92 chunks JS/CSS baixados de `viajaly.com` e inspecionados byte a byte; códigos HTTP reais com controle negativo; sondagem de Edge Functions com controle negativo; DNS e cabeçalhos.

## 3.1 Onde o app está hospedado — não é Vercel

A Seção 3 diz: *"Deploy: Vercel, já conectado ao repositório — todo PR mergeado na main publica sozinho."* **As duas afirmações são contrariadas pela evidência.**

| Evidência | Resultado |
|---|---|
| DNS `viajaly.com` | `185.158.133.1` (faixa da Lovable; Vercel seria `76.76.21.x`) |
| Cabeçalhos de resposta | `server: cloudflare`, `x-deployment-id: 363e807d…`. **Zero** cabeçalhos `x-vercel-*` |
| API da Lovable | `is_published: true`, `url: https://viaja-junto-comigo.lovable.app` |
| `viaja-junto-comigo.lovable.app` vs `viajaly.com` | **mesmo `x-deployment-id`**, mesmo chunk de entrada `index-BMQseu_i.js` (o domínio `.lovable.app` só faz 302 para `viajaly.com`) |

**É um deploy da Lovable servido por Cloudflare.** Consequência prática: **as variáveis de ambiente não estão no painel da Vercel** — procurar `VITE_SENTRY_DSN` lá não vai achar nada porque não é lá que elas moram. Toda a Seção 0 que fala em "cadastrar no Vercel" aponta para o painel errado.

E a publicação **não é automática**: cinco commits mergeados na `main` há ~19h continuam fora do ar (§3.3).

## 3.2 Rotas — códigos HTTP reais

| Rota | Código | Leitura |
|---|---|---|
| `/` | 200 | ok |
| `/trip` | 200 | ok (sem sessão, redireciona — ver abaixo) |
| **`/trip/login`** | **404** | ❌ **rota não existe no build publicado** |
| `/trip/novo` | 200 | ok |
| `/trip/financeiro` | 200 | ok |
| `/trip/checklists` | 200 | ok |
| `/trip/roteiro` | 200 | ok |
| `/trip/mais` | 200 | ok |
| `/trip/checkout` | 200 | ok |
| `/trip/aceitar-convite` | 307 | ok (redireciona) |
| `/privacidade` | 200 | ok |
| `/portal/login` | 200 | ok |
| `/api/public/payments/webhook` | 200 (GET e POST) | ✅ webhook do Stripe publicado e respondendo |
| `/zzz-nao-existe` (**controle negativo**) | 404 | calibra o 404 acima |

O 404 de `/trip/login` é real, não artefato de SPA: o corpo devolvido é idêntico ao do controle negativo, e o servidor distingue rotas (senão o controle daria 200).

**O beco sem saída continua vivo.** No chunk publicado, o `beforeLoad` do layout `/trip` faz:

```js
if(!t.session) throw be({to:`/portal/login`, search:{next: e.pathname + e.searchStr}})
```

Não existe **nenhuma** ocorrência da string `trip/login` em nenhum dos 92 chunks. Quem comprou só o Trip cai na tela da consultoria de vistos, que pede um código de 6 dígitos que ele nunca recebeu.

## 3.3 Qual build está no ar, e o que mergeou depois

**Build publicado = `main` em `e268aca` (2026-07-25T20:19:50Z) ou `8a6438c` (20:27:20Z).**
Os dois produzem bundle idêntico porque `8a6438c` (PR #69) só mexe em markdown. Prova por quatro marcadores, cada um com direção conhecida:

| Marcador | Origem | No bundle? | Conclui |
|---|---|---|---|
| Gate `VITE_POSTHOG_KEY` + 12 eventos | PR #68/#70, ≤20:06:26Z | **sim** | build ≥ #70 |
| Texto de consentimento v2 nomeando OpenRouter/DeepSeek | PR #67, 19:57:33Z | **sim** | build ≥ #67 |
| String `"ai-chat"` (transporte antigo do assistente) | removida em `e268aca`, 20:19:50Z | **não** | build ≥ `e268aca` |
| `"Continuar com Google"` no chunk `portal.login-C9kYOiwe.js` | `69a004e`, 20:40:54Z | **não** | build < `69a004e` |
| `"destino_pais, destino_cidade, num_criancas"` | PR #75, 22:02:36Z | **não** | build < #75 |
| Qualquer referência a `trip/login` | PR #72, 22:03:17Z | **não** | build < #72 |

> Nota de método: o marcador do Google foi checado **dentro do chunk `portal.login` realmente publicado**, que baixei — não por ausência na varredura geral, que poderia ser lacuna de crawl. Confirmei antes que os 25 chunks referenciados por `/portal/login` estão todos no meu conjunto.
> Também descartei um falso positivo: `"premium-counts"` existe no bundle, mas **já existia antes do PR #75**, então não serve de marcador.

### Mergeado na `main` DEPOIS do build publicado — tudo isto está mergeado e **não está no ar**

| Quando (UTC) | O quê | Impacto de estar fora |
|---|---|---|
| 25/07 20:40:54 | `69a004e` — botão "Continuar com Google" em `/portal/login` e `/console/login` | Login do portal e do console sem Google |
| 25/07 22:02:36 | **PR #75 — VJT-011b** | Teaser premium do checklist ainda conta pelo catálogo inteiro (superestima o ganho); runbook não publicado |
| 25/07 22:03:02 | PR #74 — formatação prettier | Nenhum (só lint) |
| 25/07 22:03:17 | **PR #72 — VJT-011c + VJT-011d** | **`/trip/login` inexistente; código de acesso da equipe inexistente** |
| 25/07 22:04:09 | PR #64 — fixture de teste de RLS | Nenhum (só teste) |

**~19 horas de atraso.** A `main` está verde no HEAD; o que está no ar veio de um commit vermelho.

## 3.4 Variáveis `VITE_*` que existem de fato no bundle publicado

O build inlina o objeto `import.meta.env` inteiro. Ele é legível literalmente. **Conteúdo completo:**

```js
{ BASE_URL:`/`, DEV:!1, MODE:`production`, PROD:!0, SSR:!1,
  TSS_DEV_SERVER:`false`, TSS_DEV_SSR_STYLES_BASEPATH:`/`, TSS_DEV_SSR_STYLES_ENABLED:`true`,
  TSS_DISABLE_CSRF_MIDDLEWARE_WARNING:`false`, TSS_INLINE_CSS_ENABLED:`false`,
  TSS_ROUTER_BASEPATH:``, TSS_SERVER_FN_BASE:`/_serverFn/`,
  VITE_PAYMENTS_CLIENT_TOKEN:`pk_test_51TlBCsGzi4eTZ23oiI0RU0dyNXfs6YJk3FZRZtU0Sq4yfSE4bIyZB8rmnHWqwSi5DnA5dTu1kFZDgeF4NnTvyQsY00Vp91MHzL`,
  VITE_SUPABASE_PROJECT_ID:`urrlqljlibpzaqnemlwf`,
  VITE_SUPABASE_PUBLISHABLE_KEY:`eyJ…role":"anon"…`,
  VITE_SUPABASE_URL:`https://urrlqljlibpzaqnemlwf.supabase.co` }
```

**São exatamente 4 variáveis `VITE_*`. Nada mais.**

| Variável | No bundle? | Consequência |
|---|---|---|
| `VITE_SUPABASE_URL` / `_PUBLISHABLE_KEY` / `_PROJECT_ID` | ✅ presentes | app fala com o banco |
| `VITE_PAYMENTS_CLIENT_TOKEN` | ✅ presente, **`pk_test_`** | Stripe em **modo teste** |
| **`VITE_POSTHOG_KEY`** | ❌ **ausente** | 0 eventos (§3.6) |
| **`VITE_POSTHOG_HOST`** | ❌ ausente | irrelevante sem a chave |
| **`VITE_ANALYTICS_ENABLED`** | ❌ ausente | irrelevante sem a chave |
| **`VITE_SENTRY_DSN`** | ❌ **ausente** | 0 erros reportados (§3.6) |

> **Cuidado de leitura que quase me pegou:** os nomes `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` e `VITE_ANALYTICS_ENABLED` **aparecem** como texto nos chunks. Uma contagem de ocorrências diria "existem". Mas aparecem só como *leitura de propriedade* no código do gate — `e.VITE_POSTHOG_KEY?.trim()` — e **não** como chave do objeto env inlinado acima. Ou seja: o código que as lê está publicado; os valores não existem.

**Stripe:** `pk_test_51TlBCs…` — **modo teste**, confirmado em duas ocorrências independentes (objeto env e a cópia interna do SDK do Stripe). Não há `pk_live_` em nenhum chunk.

## 3.5 Vazamento de chave sensível — **nenhum**

Varredura dos 92 chunks:

| Padrão | Ocorrências |
|---|---|
| `service_role` | **0** |
| `SUPABASE_SERVICE_ROLE` | **0** |
| `sk_live_` / `sk_test_` / `sk_` | **0** |
| `whsec_` (segredo do webhook) | **0** |
| `sk-or-v1` / `OPENROUTER` / `OPENROUTER_API_KEY` | **0** |
| `TRIP_ADMIN_CODE` / `TRIP_ADMIN` | **0** |
| `AI_MODEL`, `BREVO`, `AIza`, `ghp_`, `rk_live` | **0** |
| `process.env.` | **0** (nada de servidor vazou para o client) |

Todo JWT encontrado nos chunks foi decodificado: **existe exatamente um**, com `"role":"anon"` — a chave publicável, que é para estar ali.
`RESEND_` aparece 1 vez, mas é o identificador de erro `RESEND_COOLDOWN` numa mensagem de UI, não uma chave (não há nenhum valor `re_…`).

**Veredito: limpo.**

## 3.6 Observabilidade publicada — inerte

- **Sentry:** a string `sentry` aparece em **0 dos 92 chunks**. Sem `VITE_SENTRY_DSN`, o import dinâmico nunca acontece e o SDK é removido do bundle inteiro. **Nenhum erro de produção é capturado hoje.**
- **PostHog:** os 12 nomes de evento estão corretos no bundle (`pdf_exported`, `signup`, `trip_created`, `visa_cta_click`, `invite_accepted`, `upgrade_purchase`…), e o gate está publicado. Mas `q_()` retorna `null` sem a chave, `posthog-js` nunca é baixado. **0 eventos coletados desde o merge.**

## 3.7 Edge Functions

| Função | HTTP | Veredito |
|---|---|---|
| `lock-usd-rate` | 405 `method_not_allowed` | ✅ deployada |
| `refresh-usd-reference` | 502 `awesomeapi_429` | ✅ deployada (upstream com rate limit) |
| **`delete-account`** | **404 `NOT_FOUND`** | ❌ **existe no repo, NÃO deployada** |
| `ai-chat` | 404 | ✅ esperado — migrada para `createServerFn` em `e268aca`; não existe mais função de IA para deployar |
| `stripe-webhook`, `create-checkout-session` | 404 | ✅ esperado — nunca foram Edge Functions; o webhook é a rota `/api/public/payments/webhook`, que responde 200 |
| `funcao-que-nao-existe-controle` (**controle negativo**) | 404 | calibra os 404 acima |

**`delete-account` é o achado grave:** o botão "Excluir minha conta" está no bundle publicado e chama uma função que responde 404. O usuário clica e toma erro.

> Corrijo aqui uma afirmação do PR #79: ele diz que a `ai-chat` "está bloqueada para deploy". Não está — ela deixou de existir. E o webhook do Stripe, que ele dá como Edge Function, é rota do app.

## 3.8 PWA (VJT-016)

| Item | Resultado |
|---|---|
| `/trip/manifest.webmanifest` | **200**, JSON válido (`name`, `start_url:/trip`, `scope:/trip`, `display:standalone`, `theme_color:#10204A`, `lang:pt-BR`) |
| `/trip/icons/icon-192.png` | 200 |
| `/trip/icons/icon-512.png` | 200 |
| `/trip/icons/icon-maskable-512.png` | 200 |
| `<link rel="manifest">` no HTML de `/trip` | presente |
| Service worker (`/sw.js`, `/trip/sw.js`, `/service-worker.js`) | **404 nos três** |

Manifest e ícones estão servidos. **Não verificado:** instalação em aparelho real (o critério de aceite do ticket) — exige dispositivo. Registro o service worker ausente como fato, não como defeito: o escopo do VJT-016 era "manifest, ícones, splash", sem offline. Se o prompt de instalação do Chrome depender de SW no aparelho alvo, o aceite não fecha — **não verificado**.

## 3.9 Outras verificações de produção

- **6 gatilhos de paywall (VJT-011):** as 6 copies estão no bundle publicado — "Planeje quantas viagens quiser", "Viaje em grupo", "Roteiro sem limite de dias", "Leve o roteiro no bolso", "Mais conversas com o assistente", "Checklist completo do seu jeito". ✅
- **Consentimento LGPD v2 (VJT-017b):** publicado e nomeando os subprocessadores. Texto real no bundle: *"…para OpenRouter (Estados Unidos) e DeepSeek (China), que os processam por inteligência artificial… o que caracteriza transferência internacional"*, com a estrutura `{nome:'DeepSeek', papel:'inferência…', pais:'China', transferenciaInternacional:!0}`. ✅

---

# AS QUATRO LISTAS

## 1 · ENTREGUE E FUNCIONAL
*(mergeado + migration aplicada + verificado em produção)*

| Ticket | Evidência de produção |
|---|---|
| **VJT-001** (fundação, rotas, CI) | rotas `/trip/*` respondem 200; 19 tabelas + RLS no banco; CI verde no HEAD. **A parte Sentry não** — ver lista 2 |
| **VJT-002** (trip-math) | chunk `trip-math-C7ln3LeW.js` publicado |
| **VJT-003 / 003b / 003c** (wizard + catálogo) | `/trip/novo` 200; `checklist_templates`=142, `paises_visto`=14, `trips.num_criancas` no banco |
| **VJT-004 / 004b** (dashboard) | `/trip` 200; chunk `trip.index` publicado |
| **VJT-005 / 006 / 006b** (financeiro) | `/trip/financeiro` 200; 21 colunas `*_cents` |
| **VJT-007 / 007b** (checklists) | `/trip/checklists` 200 |
| **VJT-008** (roteiro) | `/trip/roteiro` 200 |
| **VJT-009** (visto contextual) | `paises_visto`=14; evento `visa_cta_click` no bundle |
| **VJT-010** (export PDF) | código no bundle publicado |
| **VJT-011** (entitlements + paywall) | as **6** copies de gatilho no bundle; `entitlements` na publication realtime |
| **VJT-013** (convites) | `accept_trip_invite()` existe; `trip_invites` com token opaco e expiração de 7 dias; RLS com 3 policies |
| **VJT-016** (PWA) | manifest + 3 ícones em 200 — *com a ressalva de §3.8* |
| **VJT-017b** (LGPD v2) | texto publicado nomeia OpenRouter/DeepSeek; migration aplicada (PK `id` + unique) |

**Ressalva honesta que vale para a lista inteira:** confirmei que as rotas respondem, que o código está no bundle e que o schema existe. **Não percorri nenhuma tela autenticada** — não montei sessão de usuário nesta auditoria. O comportamento interno dessas telas é exatamente o buraco que o VJT-018 existe para fechar, e ele não está mergeado.

## 2 · ENTREGUE MAS INERTE
*(código no ar, sem efeito por pendência manual)*

### 2.1 — Sentry (VJT-001)
- **O que falta:** cadastrar `VITE_SENTRY_DSN` no ambiente e republicar.
- **Quem faz:** **você**, no painel — **da Lovable, não da Vercel** (§3.1).
- **Dano concreto:** nenhum erro de produção é registrado. Qualquer exceção que quebre a tela de um usuário some sem rastro. Hoje o custo é teórico (0 usuários); no dia do lançamento você fica cego exatamente quando mais precisa enxergar.

### 2.2 — PostHog / VJT-015
- **O que falta:** `VITE_POSTHOG_KEY` (e, opcionais, `VITE_POSTHOG_HOST`, `VITE_ANALYTICS_ENABLED`); republicar; criar os 2 funis no painel do PostHog a partir dos nomes em `src/lib/trip-analytics.ts`.
- **Quem faz:** **você** (painel Lovable + painel PostHog).
- **Dano concreto:** **0 eventos desde o merge.** Os dois funis do PRD (grátis→compra, visto→lead) não existem. O ticket foi bem executado — os 12 eventos estão certos no bundle — e não mede nada.

### 2.3 — Stripe / VJT-012
- **O que falta:** `pk_live_` no client, chave secreta live no servidor, `PAYMENTS_ENABLED=true`, webhook apontado para o endpoint live; republicar.
- **Quem faz:** **você** (Stripe + painel Lovable).
- **Dano concreto:** **o v1 não tem receita ligada.** O webhook responde 200 e a idempotência está no banco, mas o checkout publicado é de teste: ninguém consegue pagar de verdade.
- **Não verificado:** o valor de `PAYMENTS_ENABLED` — é env de servidor (`process.env`), invisível de fora. O `pk_test_` já basta para o veredito.

### 2.4 — Exclusão de conta / VJT-017
- **O que falta:** **deployar a Edge Function `delete-account`** (existe em `supabase/functions/delete-account`, responde 404 em produção).
- **Quem faz:** **você** (deploy da função) — ou um agente, se o deploy puder ser feito por conector.
- **Dano concreto:** o botão está no ar e quebra. É o direito de exclusão da LGPD anunciado na interface e não entregue. Com 0 usuários o dano corrente é zero; com o primeiro usuário vira exposição regulatória real, e é uma reclamação que chega antes de qualquer métrica.

### 2.5 — Assistente IA / VJT-014 — **parcialmente não verificado**
- O assistente migrou para `createServerFn`; não há Edge Function a deployar. As funções `increment_ai_usage()` e `ai_daily_message_count()` existem no banco.
- **Não verificado:** se os secrets de servidor (`OPENROUTER_API_KEY`, `AI_MODEL`, `AI_ENABLED`) estão configurados — são env de servidor, não observáveis do bundle nem por HTTP sem sessão autenticada. `ai_messages` tem 0 linhas, o que é compatível tanto com "funciona e ninguém usou" quanto com "não funciona".
- **Ação sua:** confirmar no painel que `OPENROUTER_API_KEY` existe.

## 3 · MERGEADO MAS NÃO PUBLICADO
*(está na `main`, não está no ar)*

**Causa comum a todos:** a publicação não é automática, e não acontece desde 25/07 ~20:27Z. **Uma ação sua resolve os quatro de uma vez: publicar a `main`.**

### 3.1 — VJT-011d (login próprio do Trip) — **o mais grave desta lista**
- **Falta:** publicar (PR #72 mergeado às 22:03:17Z). Depois: `TRIP_ADMIN_EMAIL` + `TRIP_ADMIN_CODE` no ambiente, e confirmar `https://viajaly.com/**` nas Redirect URLs do Supabase Auth.
- **Quem faz:** **você** (publicar + envs + painel do Supabase).
- **Dano concreto:** **quem comprar só o Trip não consegue entrar.** `/trip/login` dá 404 e `/trip` joga a pessoa em `/portal/login`, que pede um código de 6 dígitos de uma consultora que ela não tem. Foi o que travou você mesmo. Enquanto isso durar, o Trip não é vendável separado — que é a tese do produto.

### 3.2 — VJT-011c (código de acesso admin)
- **Falta:** publicar + cadastrar `TRIP_ADMIN_CODE`.
- **Quem faz:** **você**.
- **Dano concreto:** liberar Premium (QA, demo, bônus Pro+/Vip+) continua exigindo SQL Editor e descobrir o `user_id` na mão. Some o rastro em `audit_log` que só o caminho por código gera.

### 3.3 — VJT-011b (teaser premium por variáveis da trip + runbook)
- **Falta:** publicar (PR #75).
- **Quem faz:** **você**.
- **Dano concreto:** o teaser "+N itens completos" conta o catálogo premium inteiro (112 itens) em vez do que aquela viagem específica ganharia. **Promessa inflada no gatilho de paywall** — o usuário paga esperando mais do que vai receber. É dano de conversão e de confiança, não cosmético.

### 3.4 — Botão "Continuar com Google" no portal/console (`69a004e`)
- **Falta:** publicar.
- **Quem faz:** **você**.
- **Dano concreto:** `/portal/login` e `/console/login` seguem só com link mágico e código. Atrito de login para o produto de vistos, que já tem clientes.

*(PR #74 — prettier — e PR #64 — fixture de teste — também não estão no ar; nenhum impacto para o usuário.)*

## 4 · NÃO ENTREGUE
*(nunca executado, ou executado e não mergeado)*

### 4.1 — VJT-018 QA mobile e performance — **executado, NÃO mergeado**
- **Estado:** issue #80 aberta, **PR #81 aberto (draft) há ~17,5h**, CI verde.
- **Falta:** revisar e mergear. É a **Definition of done do milestone v1**.
- **Quem faz:** **você** (merge é sempre humano, Seção 6 passo 12).
- **Dano concreto:** o v1 não tem DoD cumprida. Além disso, o PR #81 já traz **três achados que ninguém decidiu**: dashboard em **2,45s** em 4G com CPU 4× (critério é 2s); Google Fonts render-blocking em todas as rotas; e `useEntitlement` inscrevendo o mesmo canal de realtime várias vezes, onde desmontar um componente **derruba o realtime dos outros** — que ataca direto o aceite do VJT-012 ("compra ativa premium sem reload"). Deixar o PR parado deixa esses três em aberto.
> **Correção de registro:** o PR #79 afirma que "o VJT-018 nunca foi executado — zero issues e zero PRs". Isso era verdade quando #79 foi escrito (22:38Z); a issue #80 e o PR #81 nasceram depois (00:06Z e 00:10Z do dia 26). Hoje a afirmação está desatualizada.

### 4.2 — VJT-019 Auditoria final — **executado, NÃO mergeado**
- **Estado:** issue #78 aberta, PR #79 aberto (draft) há ~19h.
- **Dano concreto:** baixo em si, mas o PR carrega a reescrita da Seção 0 que consertaria as duplicatas do documento (§5). Enquanto não mergear, a Seção 0 segue mentindo. Antes de mergear, ver as correções em §5.3 — **#79 tem erros próprios**.

### 4.3 — VJT-011b follow-up (runbook) — **executado, NÃO mergeado**
- **Estado:** issue #76 aberta, PR #77 aberto (draft) há ~19h.
- **Dano concreto:** o runbook publicado descreve o SQL Editor como *o* procedimento e não menciona o código de acesso. Quem for ativar um Premium hoje faz pelo caminho longo. Menor que os outros, e some se #77 mergear.

---

# 5 · O QUE A SEÇÃO 0 E A SEÇÃO 8 AFIRMAM × O QUE VERIFIQUEI

## 5.1 Linhas duplicadas e contraditórias na Seção 0

O documento tem **quatro pares de linhas duplicadas**, resquício das consolidações de onda em paralelo. Em três pares as duas versões **se contradizem**:

| Linhas | Campo | Versão A | Versão B | Realidade verificada |
|---|---|---|---|---|
| 9 e 12 | "Ticket em aberto aguardando review" | "**— nenhum**" | "**VJT-015**, PR #68 draft" | **Ambas erradas.** VJT-015 mergeou 19:58:15Z. Os abertos hoje são #71, #77, #79, #81 |
| 10 e 13 | Migrations no Supabase | "7 aplicadas e verificadas; falta só a do VJT-017b" | "**Não verificável nesta sessão**; nenhuma aplicada" | **Ambas erradas.** **Todas** aplicadas, VJT-017b inclusive. Zero pendentes |
| 11 e 14 | LGPD vs. subprocessadores | "PR #67 mergeado; falta a migration" | "Bloqueante; nada nomeia subprocessador" | **Ambas obsoletas.** Texto v2 publicado, migration aplicada, assunto encerrado |
| 19 e 20 | "Última atualização desta seção" | 2026-07-25 (migrations) | 2026-07-25 (consolidação de onda) | duplicata sem contradição |

## 5.2 Divergências ponto a ponto — Seção 0 e Seção 8

| # | O documento afirma | Verifiquei | Camada |
|---|---|---|---|
| 1 | "VJT-015 **em review**, PR #68 draft" (L7, L12; log L460) | **Mergeado** em 2026-07-25T19:58:15Z, mais conserto #70 às 20:06:26Z | 1 |
| 2 | "Única migration pendente: `vjt017b_lgpd_consent_history`" (L10, L19, L458) | **Aplicada.** PK = `id`, unique `user_lgpd_consents_user_versao_unique`, coluna `id` presente | 2 |
| 3 | "Bloqueante para o **deploy da `ai-chat`**" (L11, L14, L458) | **Obsoleto.** A `ai-chat` deixou de existir em `e268aca` (migrada para `createServerFn`). Não há função para deployar | 1+3 |
| 4 | "Migrations exigem aplicação manual; conector não alcança o projeto" (L13, L75, L451) | **Falso hoje.** O conector **Lovable** alcança e executa SQL. Só o conector **Supabase** não vê o projeto | 2 |
| 5 | "`VITE_SENTRY_DSN` / `VITE_POSTHOG_KEY` — cadastrar **no Vercel**" (L15, L16, L448, L479) | **Painel errado.** Não há Vercel: DNS `185.158.133.1`, zero cabeçalhos `x-vercel-*`, mesmo deployment que `viaja-junto-comigo.lovable.app` | 3 |
| 6 | "Deploy: **Vercel**… todo PR mergeado na main **publica sozinho**" (L72) | **As duas metades erradas.** Hospedagem Lovable/Cloudflare, e 5 merges estão fora do ar há ~19h | 3 |
| 7 | "VJT-011b (sem bloqueio) **segue disponível**" (L7) | **Feito e mergeado** (PR #75, 22:02:36Z). Já registrado na issue #76 | 1 |
| 8 | "VJT-003c e VJT-007b seguem disponíveis" (L7) | **Ambos mergeados** — #23 (24/07 20:27:57Z) e #47 (25/07 14:08:16Z) | 1 |
| 9 | "Ondas 1–7 fechadas… VJT-018 destrava" (L7) | VJT-018 **não está mergeado** (PR #81 draft). O milestone não fechou | 1 |
| 10 | Seção 8 não tem entrada de VJT-011b, VJT-012→017 consolidados como "onda fechada" | **Faltam entradas** de VJT-011b, VJT-018 e VJT-019 no Log. A regra "sem entrada = tarefa não existe" está sendo violada por três tarefas que existem | 1 |
| 11 | VJT-011c/011d: "implementado, aguardando envs" (L419, L434) | Correto quanto ao merge, **incompleto quanto ao estado**: não está só faltando env — **não está publicado** | 1+3 |
| 12 | VJT-016: "Mergeado" | Confirmado. Mas o aceite ("instalado em dispositivo real") **não foi verificado por ninguém** — nem por mim, nem no log | 3 |
| 13 | Seção 3: "IA via **Edge Function** (chave nunca no client)" (L71) | Deixou de ser Edge Function (agora `createServerFn`). A garantia de a chave não ir ao client **continua válida** — confirmei 0 ocorrências de `OPENROUTER` nos 92 chunks | 3 |
| 14 | Seção 0 não menciona nenhum PR aberto além do VJT-015 | Há **4 PRs abertos** (#71, #77, #79, #81) e **3 issues abertas** (#76, #78, #80) | 1 |

## 5.3 Divergências minhas contra o PR #79 (auditoria VJT-019)

O #79 está aberto e é o candidato natural a virar a nova Seção 0. **Três coisas nele precisam de correção antes disso:**

| # | PR #79 afirma | Verifiquei |
|---|---|---|
| 1 | "VJT-018 nunca foi executado — zero issues e zero PRs" | Verdade às 22:38Z; **desatualizado hoje** — issue #80 e PR #81 existem |
| 2 | "O webhook [do Stripe] está publicado e responde" (tratado como Edge Function) | Correto no resultado, errado no mecanismo: é a rota `/api/public/payments/webhook` (200), não Edge Function |
| 3 | "O build no ar é de entre 19:58Z e 20:29Z" | Janela apertável: **≥ `e268aca` (20:19:50Z)** e **< `69a004e` (20:40:54Z)** |
| 4 | Lista VJT-011b como "mergeado mas não publicado" junto de 011c/011d | Concordo — e acrescento o commit `69a004e` (botão Google), que #79 não lista |
| 5 | Não menciona hospedagem | #79 mantém a premissa "Vercel" do documento. **É Lovable** — e isso muda o painel onde você vai cadastrar as variáveis |

---

# 6 · DEFINITION OF DONE DO MILESTONE v1 (Seção 2), item por item

> Nota de procedência: a Seção 2 se chama "Regras não negociáveis"; é o que o pedido trata como DoD. Somei a ela o critério de aceite do VJT-018 ("todos os critérios de aceite anteriores re-verificados numa passada só"), que a Seção 7 nomeia explicitamente como *"Definition of done do milestone"*.

| # | Item da DoD | Veredito | Evidência / camada |
|---|---|---|---|
| 1 | Fórmulas em módulo puro `trip-math` com testes | ✅ | chunk `trip-math-C7ln3LeW.js` publicado (3). Contagem de testes **não verificada** (deps não instaladas) |
| 2 | Edge case: modo sonho | ⚠️ **não verificado** | exige sessão autenticada. PR #81 reporta ok, mas não está mergeado |
| 3 | Edge case: modo concluída + NPS | ⚠️ **não verificado** | idem. Tabela `trip_nps_responses` existe (2) |
| 4 | Edge case: meta zero | ⚠️ **não verificado** | idem |
| 5 | Edge case: estouro de categoria | ⚠️ **não verificado** | idem |
| 6 | Edge case: divisão por zero | ⚠️ **não verificado** | idem |
| 7 | Fonte única de plano (`entitlements` + um hook) | ✅ | tabela existe, RLS ON, 1 policy de leitura própria (2) |
| 8 | **6 gatilhos de paywall no mesmo modal** | ✅ | as 6 copies no bundle publicado (3) |
| 9 | Item de visto via `paises_visto`, com UTM, nunca bloqueante | ✅ | `paises_visto`=14 (2); `visa_cta_click` no bundle (3) |
| 10 | **RLS em todas as tabelas via `is_trip_member()`** | ✅ | **19/19 com RLS ON**; `is_trip_member()` existe (2) |
| 11 | Nunca usar service role no client | ✅ | **0 ocorrências** de `service_role` nos 92 chunks; único JWT é `anon` (3) |
| 12 | Convite por token opaco, 7 dias, aceite por RPC | ✅ | `token = encode(gen_random_bytes(24),'hex')`, `expires_at = now()+'7 days'`, `accept_trip_invite()` existe (2) |
| 13 | Valores em centavos | ✅ | 21 colunas `*_cents` (2) |
| 14 | UI 100% PT-BR | ⚠️ parcial | PR #81 achou `Close` em inglês em `dialog.tsx`/`sheet.tsx` — **corrigido só no PR #81, não mergeado** |
| 15 | Todo card com empty state | ⚠️ **não verificado** | exige sessão. PR #81 reporta ok |
| 16 | Mobile-first, bottom nav de 5 itens | ⚠️ **não verificado** | exige sessão |
| 17 | Fora de escopo respeitado | ✅ | nenhum sinal de parcelamento, push, split de custos ou câmbio automático no bundle (3) |
| 18 | Observabilidade (Sentry + PostHog) | ❌ **falha** | ambos inertes (§3.6) |
| 19 | **Jornada P1 completa em aparelho real** (VJT-018) | ❌ **falha** | PR #81 aberto; e rodou em stack local, não em produção |
| 20 | **Dashboard < 2s em 4G** (VJT-018) | ❌ **falha** | PR #81 mediu **2,45s** com CPU 4× (aparelho médio). Nunca medido contra produção |
| 21 | PWA instalado em dispositivo real (VJT-016) | ⚠️ **não verificado** | manifest e 3 ícones em 200 (3); instalação exige aparelho |

**Placar: 9 ✅ · 9 ⚠️ não verificado · 3 ❌ falha.**
**A DoD do milestone v1 não está cumprida.** Os três ❌ são todos endereçáveis: dois pelo merge do PR #81 mais uma decisão sua sobre os 2,45s; um pelo cadastro de duas variáveis de ambiente.

Ressalva de preço, que continua valendo: só existe `PREMIUM_PRICE_BRL_CENTS = 6700`. O preço cheio de **R$ 97 não existe como constante** — encerrar o preço de lançamento vai exigir mudança de código, não configuração.

---

# 7 · O QUE NÃO CONSEGUI VERIFICAR (e por quê)

| Item | Por quê |
|---|---|
| Comportamento de qualquer tela autenticada | Não montei sessão de usuário. É o buraco que o VJT-018 fecha |
| `PAYMENTS_ENABLED` | Env de servidor (`process.env`), invisível de fora. O `pk_test_` já decide o veredito |
| `OPENROUTER_API_KEY`, `AI_MODEL`, `AI_ENABLED` | Secrets de servidor |
| `TRIP_ADMIN_CODE`, `TRIP_ADMIN_EMAIL` | Secrets de servidor — e o código que os lê nem está publicado |
| Redirect URLs do Supabase Auth (`https://viajaly.com/**`) | O conector não expõe a configuração de Auth do projeto |
| Semântica de cada policy de RLS | Verifiquei que RLS está ON e quantas policies existem, não o que cada expressão permite. Exige teste com dois usuários autenticados |
| `scripts/test-rls.sh --audit` | Depende de stack local com dependências |
| Suíte de testes local | `node_modules` não instalado neste ambiente (`ERR_MODULE_NOT_FOUND`). Não instalei para não alterar o repositório numa auditoria |
| Instalação do PWA em aparelho real | Exige dispositivo |
| Dashboard < 2s em 4G **contra produção** | Exige navegador com throttling contra o site publicado |
| Variáveis no painel da Vercel | **Não se aplica** — não há Vercel neste deploy (§3.1) |

---

# 8 · SUAS AÇÕES MANUAIS, EM ORDEM DE DANO

| # | Ação | Dano de não fazer |
|---|---|---|
| **1** | **Publicar a `main` (deploy da Lovable) e descobrir por que a publicação parou** | Quem comprar só o Trip **não consegue entrar** — `/trip/login` dá 404 e o app joga a pessoa na tela da consultoria pedindo um código que ela não tem. O produto está à venda sem porta de entrada, e essa única ação também resolve os itens 3.1 a 3.4 da lista 3 |
| **2** | **Deployar a Edge Function `delete-account`** | O botão "Excluir minha conta" está no ar e responde 404: direito de exclusão da LGPD anunciado na interface e quebrado. Zero usuários hoje; vira exposição regulatória com o primeiro |
| **3** | **Cadastrar `VITE_SENTRY_DSN` e republicar** | Nenhum erro de produção é capturado. Você lança às cegas e só descobre que quebrou quando alguém reclamar — se reclamar |
| **4** | **Trocar o Stripe para live (`pk_live_` + secret live + `PAYMENTS_ENABLED=true` + webhook live)** | **O v1 não fatura.** O checkout publicado é `pk_test_`: ninguém consegue pagar de verdade. Todo o VJT-012 está no ar sem gerar um centavo |
| **5** | **Cadastrar `VITE_POSTHOG_KEY` e criar os 2 funis no painel** | Zero eventos coletados. Você decide o que priorizar no v2 sem nenhum dado sobre onde as pessoas travam |
| **6** | **Revisar e mergear o PR #81 (VJT-018) e decidir os três achados dele** | A DoD do milestone segue não cumprida; e ficam sem decisão o dashboard em 2,45s, o Google Fonts bloqueando render em todas as rotas, e o bug de realtime do `useEntitlement` que **pode fazer a compra não liberar o Premium sem reload** — o aceite do VJT-012 |
| **7** | **Cadastrar `TRIP_ADMIN_CODE` + `TRIP_ADMIN_EMAIL`** (depois do item 1) | Sem eles, QA interno, demo para cliente e bônus Pro+/Vip+ continuam exigindo SQL Editor e caçar `user_id` na mão, sem rastro em `audit_log` |
| **8** | **Confirmar `https://viajaly.com/**` nas Redirect URLs do Supabase (Auth → URL Configuration)** | Depois do item 1, Google Sign-In e link mágico não voltam para o app — o login novo nasce quebrado e parece bug de código |
| **9** | **Confirmar que `OPENROUTER_API_KEY` está configurada** | O assistente de IA — diferencial premium e motor de conversão — pode estar respondendo erro para todo mundo sem ninguém saber (não consegui verificar) |
| **10** | **Revisar e mergear #77 e #79 (com as correções de §5.3), e reconciliar a Seção 0** | A memória do projeto está mentindo em 14 pontos. O protocolo manda ler a Seção 0 primeiro; enquanto ela estiver errada, toda sessão futura começa com premissa falsa e refaz trabalho já feito — como já aconteceu duas vezes (VJT-006b mergeado em duplicidade, VJT-011b reexecutado) |
| **11** | **Fechar o PR #71 (obsoleto) e apagar as 37 branches órfãs** | Ruído: a lista de PRs/branches deixou de indicar o que está em andamento |
| **12** | **Decidir se o editor Lovable pode continuar empurrando direto para a `main`** | 8 commits entraram sem PR e sem CI; o build que está no ar veio de um deles, com CI vermelho. É por onde a `main` quebrou em 25/07 |
| **13** | **Renomear as 3 migrations com timestamp `20260725200000`** | Inofensivo hoje (aplicação manual), mas colide na chave de versão no dia em que o projeto usar `supabase db push` |

---

## Nota de método

Camada 1: API do GitHub, com estado de merge lido de `merged_at` (o campo `merged` da listagem vem `false` para todos os PRs e não é confiável).
Camada 2: SQL executado contra `urrlqljlibpzaqnemlwf` pelo conector Lovable — catálogo do Postgres (`information_schema`, `pg_class`, `pg_policies`, `pg_proc`, `pg_constraint`, `pg_indexes`, `pg_publication_tables`) e contagens.
Camada 3: 92 chunks JS/CSS baixados de `viajaly.com` e inspecionados; códigos HTTP com controle negativo (`/zzz-nao-existe` → 404) para calibrar 404 de rota; Edge Functions com controle negativo (`funcao-que-nao-existe-controle` → 404) para separar não-deployada de deployada; DNS e cabeçalhos de resposta para identificar a hospedagem.
