# VIAJALY TRIP — Documento Único de Execução
> **Como usar**: coloque este arquivo na raiz do repositório `mzinhoww-svg/viaja-junto-comigo` (o mesmo do app de visto). Abra o Claude Code (Desktop, remoto ou terminal) nesse repositório e diga: **"Leia VIAJALY-TRIP.md e execute o protocolo."** Este arquivo é auto-suficiente: contém missão, regras, schema, backlog e log. Ele é reescrito por você mesmo (Claude Code) a cada ticket concluído — é sua própria memória entre sessões. Nunca crie CLAUDE.md, GUIA.md ou TICKETS.md separados: tudo vive aqui.
---
## 0. STATUS ATUAL — leia isto primeiro, sempre
| Campo | Valor |
|---|---|
| Onda atual | 1 — Fundação **parcialmente** concluída: VJT-001, VJT-002 e VJT-008 mergeados; **VJT-003 (wizard de onboarding) NÃO foi mergeado — não existe PR nem issue aberta para ele**, apesar de ter rodado em paralelo com os outros dois (ver nota abaixo) |
| Último ticket concluído (mergeado) | VJT-002 (PR [#15](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/15), issue [#12](https://github.com/mzinhoww-svg/viaja-junto-comigo/issues/12), mergeado em 2026-07-24 13:49) — também mergeados na mesma janela: VJT-001 (PR #11, 12:20) e VJT-008 (PR [#14](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/14), issue [#13](https://github.com/mzinhoww-svg/viaja-junto-comigo/issues/13), 13:15) |
| Ticket em aberto aguardando review | — nenhum (não há PR aberto nem para VJT-003, que segue não iniciado apesar de estar desbloqueado desde o merge de VJT-001) |
| Migration aplicada no Supabase | **Sim** — aplicada manualmente via SQL Editor do dashboard em 2026-07-24 (o conector Supabase desta conta não acessa o projeto `urrlqljlibpzaqnemlwf`, gerenciado pelo Lovable Cloud). Confirmada indiretamente: o `types.ts` regenerado automaticamente pelo Lovable Cloud em `main` já reflete as 16 tabelas e as funções `accept_trip_invite`/`is_trip_member`/`is_trip_owner`. Falta só confirmar as contagens de seed: `select count(*) from paises_visto` = 14 e `select count(*) from checklist_templates` = 15 |
| Última atualização desta seção | 2026-07-24 |
> ⚠️ **Divergência encontrada e reconciliada nesta sessão**: uma sessão anterior pediu para tratar VJT-003 como já mergeado (junto com VJT-001/002/008). Checado contra o GitHub: **isso é falso** — não há PR (aberto, fechado ou mergeado) nem issue para VJT-003 neste repositório, e nenhuma branch remota remanescente contém esse trabalho. Ver Seção 8 para o motivo (não foi log, foi verificação direta via `git log`/API do GitHub). VJT-003 continua bloqueado apenas por VJT-001 (já mergeado) — está desbloqueado para execução, só não foi executado ainda.
**Protocolo de toda sessão, sem exceção:**
1. Leia esta seção 0 e a seção 8 (Log). Se este arquivo e o estado real do repositório divergirem (ex.: PR já mergeado mas não registrado aqui), reconcilie a seção 0 e o log ANTES de fazer qualquer coisa nova
2. Determine o próximo ticket executável: primeiro ticket da seção 7 cujo "Bloqueado por" já está com status Mergeado no log, e que ainda não tem entrada de conclusão
3. Se não houver ticket executável (tudo bloqueado ou tudo feito), reporte isso e pare
4. Execute o ticket seguindo a seção 6 (protocolo de execução)
5. Ao final: atualize a seção 0 (estado) e adicione uma entrada na seção 8 (log), na mesma edição deste arquivo, e pare — aguarde review e merge humano antes de seguir para o próximo
6. Nunca faça merge de PR. Essa ação é sempre humana
---
## 1. Missão e contexto
Viajaly Trip é o companion de planejamento de viagens internacionais da Viajaly. Entra como rotas `/trip/*` dentro do app existente (mesmo repositório, mesmo Supabase, mesmo Stripe, mesmo deploy Vercel) — não é produto de repositório separado.
**Tese**: transformar uma viagem cara e complexa em um plano mensal visível e compartilhado. Grátis adquire audiência; premium monetiza; destinos que exigem visto geram leads contextuais (nunca bloqueantes) para a consultoria Viajaly.
**Personas**: P1 planejadora de família (prioridade máxima — toda decisão de UX resolve ela primeiro); P2 casal na primeira viagem internacional (ativa a colaboração); P3 viajante recorrente solo (beneficiária passiva do multi-trip premium).
**Referência funcional**: mecânica do "Disney Smart by Magic Dani" (dashboard de progresso, countdown, checklists, financeiro com meta mensal, roteiro com PDF), generalizada para qualquer destino, com três diferenciais: moeda dual com câmbio manual, colaboração entre viajantes, assistente IA contextual.
---
## 2. Regras não negociáveis
**Fórmulas** — implementar em módulo puro `trip-math` (nome de arquivo à escolha do agente na Fase 1), com testes unitários:
```
meta                  = Σ valor_estimado consolidado em BRL de todos os budget_items
consolidado_brl       = valor_brl ?? (valor_destino × cambio_manual)
acumulado             = Σ savings_entries + Σ valor_pago consolidado
progresso_financeiro  = acumulado / meta                         (meta 0 → indicador oculto + CTA)
meses_restantes       = max(1, floor(meses até data_viagem))
sugestao_mensal       = max(0, (meta − acumulado) / meses_restantes)
progresso_checklists  = itens done / itens totais                (global da trip)
progresso_jornada     = 0.5 × progresso_checklists + 0.5 × progresso_financeiro   (pesos em constante, não hardcoded)
```
**Edge cases obrigatórios em toda entrega**: sem data de viagem (modo sonho — sem countdown, sem sugestão mensal); data no passado (modo concluída — retrospectiva + NPS + CTA nova viagem); meta zero; valor pago > estimado na categoria (badge de estouro, nunca bloqueia); divisão por zero em qualquer fórmula acima.
**Planos e paywall**:
| Recurso | Free | Premium |
|---|---|---|
| Viagens | 1 | Ilimitadas |
| Membros por viagem | Solo | Até 5 |
| Checklists | Básicos (~30 itens) | Completos (80-120) + packs por destino |
| Financeiro (economia + orçamento) | Completo | Completo |
| Roteiro | Até 5 dias | Ilimitado |
| Export PDF | Não | Sim |
| Assistente IA | 10 msgs/mês | 100 msgs/mês |
- Premium é **por usuário** (não por viagem), one-time **R$ 97** (lançamento R$ 67), ou bônus incluso apenas nos pacotes **Pro+ e Vip+** da consultoria (Start+ fica de fora — vira argumento de upsell interno)
- Fonte única de plano: tabela `entitlements`. Um único hook/helper no client (`useEntitlement()` ou equivalente). Nunca checar plano ad hoc em componente
- 6 gatilhos de paywall, todos abrindo o MESMO modal: criar 2ª viagem, convidar membro, adicionar 6º dia de roteiro, exportar PDF, esgotar cota de IA, abrir item de checklist premium
- Item "Visto" no checklist Documentos aparece só quando o destino exige visto para brasileiros (tabela `paises_visto`); card com link com UTM para a consultoria; **nunca bloqueante**
**Segurança**: RLS em TODAS as tabelas do produto via função `is_trip_member(trip_id)` (security definer). Nunca desabilitar RLS. Nunca usar service role no client. Convites via token opaco com expiração de 7 dias; aceite via RPC própria (o convidado ainda não é membro, então não passa nas policies normais).
**Fora de escopo (não implementar sem pedido explícito)**: parcelamento no orçamento, notificações push/email, edição colaborativa em tempo real, API de câmbio automático, split de custos entre membros, IA escrevendo direto no roteiro, app nativo.
**Regras de fatiamento de ticket**: nunca existe ticket separado só de testes (testes vivem no ticket da feature); migration junto da feature que a usa; um PR não trivial mira menos de ~400 linhas; ticket grande demais é quebrado antes de começar; feature arriscada nasce com kill switch (flag de ambiente) e observabilidade.
---
## 3. Stack e conectores já disponíveis
- Frontend: React + TypeScript + Vite/Next (o que a codebase existente já usa) + Tailwind, adicionado como rotas `/trip/*` dentro do repositório atual
- Backend: Supabase (Postgres, Auth, RLS, Edge Functions) — **mesmo projeto** do app de visto, login automaticamente compartilhado
- Pagamentos: Stripe, checkout one-time — **mesma conta** já integrada ao app
- IA: Anthropic API via Supabase Edge Function (chave nunca no client), modelo econômico (classe Haiku)
- Deploy: Vercel, já conectado ao repositório — todo PR mergeado na main publica sozinho
- Observabilidade: Sentry (erros) + PostHog (produto), a configurar nos tickets VJT-001 e VJT-016
**Conectores ativos nesta conta**: GitHub (repo `mzinhoww-svg/viaja-junto-comigo` — issues, PRs, CI, commits), Supabase (projetos, SQL, migrations, edge functions, logs), Vercel (só web analytics — variáveis de ambiente ainda exigem clique manual no painel), Claude Code Remote (ambientes, sessões, rotinas agendadas). **Não há Linear nem Orca conectados** — por isso: tickets vivem como Issues do GitHub (não Linear), e paralelismo vem de sessões/ambientes do Claude Code Remote (não Orca/Conductor). Use os conectores diretamente; nunca peça ao usuário um token para o que a conexão já cobre.
**Nota (2026-07-24)**: o conector Supabase desta conta só enxerga 3 projetos de outras contas/produtos (`crm-ai-studio`, `supabase-purple-book`, `the-loyalty`) — não tem acesso ao projeto `urrlqljlibpzaqnemlwf` deste app (gerenciado pelo Lovable Cloud). Migrations deste produto continuam precisando de aplicação manual via SQL Editor do dashboard até isso mudar.
Valores monetários: sempre em centavos (integer). UI 100% em PT-BR; código e commits em inglês, padrão de commits convencional (feat/fix/chore). Mobile-first (base 375px), bottom nav de 5 itens (Jornada, Financeiro, Checklists, Roteiro, Mais). Todo card tem empty state com CTA — tela vazia é bug.
---
## 4. Modelo de dados (aplicar via Supabase na Fase 1 / VJT-001)
```sql
-- =============================================================
-- Viajaly Trip — Schema inicial (MVP)
-- Valores monetários em CENTAVOS (integer).
-- RLS por pertencimento à trip via is_trip_member().
-- =============================================================
create type trip_status as enum ('sonho', 'planejando', 'concluida');
create type member_role as enum ('owner', 'editor');
create type checklist_type as enum ('documentos', 'preparativos', 'mala', 'compras', 'custom');
create type slot_period as enum ('manha', 'tarde', 'noite');
create type plan_tier as enum ('free', 'premium');
create type entitlement_origin as enum ('stripe', 'pacote_visto', 'manual');
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  nome text not null default 'Minha Viagem',
  destino_pais text not null,
  destino_cidade text,
  data_viagem date,
  num_pessoas int not null default 1 check (num_pessoas between 1 and 10),
  moeda_destino char(3),
  cambio_manual numeric(12,4),
  cambio_atualizado_em timestamptz,
  status trip_status not null default 'planejando',
  created_at timestamptz not null default now()
);
create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'editor',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  nome text not null,
  cor text not null default '#0EA5E9',
  ordem int not null default 0,
  is_default boolean not null default false
);
create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category_id uuid not null references public.budget_categories(id) on delete cascade,
  nome text not null,
  valor_estimado_brl_cents bigint check (valor_estimado_brl_cents >= 0),
  valor_estimado_destino_cents bigint check (valor_estimado_destino_cents >= 0),
  valor_pago_brl_cents bigint not null default 0 check (valor_pago_brl_cents >= 0),
  valor_pago_destino_cents bigint not null default 0 check (valor_pago_destino_cents >= 0),
  nota text,
  created_at timestamptz not null default now(),
  check (valor_estimado_brl_cents is not null or valor_estimado_destino_cents is not null)
);
create table public.savings_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  mes_ano date not null,
  valor_brl_cents bigint not null check (valor_brl_cents > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (trip_id, mes_ano, created_by)
);
create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  tipo checklist_type not null,
  nome text not null,
  ordem int not null default 0
);
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  titulo text not null,
  done boolean not null default false,
  nota text,
  prazo_dias_antes int,
  marco int,
  ordem int not null default 0
);
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  tipo checklist_type not null,
  titulo text not null,
  marco int,
  prazo_dias_antes int,
  tier plan_tier not null default 'free',
  regiao text,
  clima text,
  min_duracao int,
  com_crianca boolean,
  destino_pack text,
  ordem int not null default 0
);
create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  dia_numero int not null check (dia_numero >= 1),
  data date,
  ordem int not null default 0,
  unique (trip_id, dia_numero)
);
create table public.itinerary_slots (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days(id) on delete cascade,
  periodo slot_period not null,
  onde_ir text,
  onde_comer text,
  observacoes text,
  unique (day_id, periodo)
);
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  mes_ano date not null,
  msgs_count int not null default 0,
  primary key (user_id, mes_ano)
);
create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plano plan_tier not null default 'free',
  origem entitlement_origin,
  stripe_payment_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.paises_visto (
  pais_iso char(2) primary key,
  pais_nome text not null,
  exige_visto_br boolean not null,
  tipo_visto text,
  link_consultoria text
);
create index idx_trip_members_user on public.trip_members(user_id);
create index idx_budget_items_trip on public.budget_items(trip_id);
create index idx_budget_items_category on public.budget_items(category_id);
create index idx_savings_trip on public.savings_entries(trip_id);
create index idx_checklists_trip on public.checklists(trip_id);
create index idx_checklist_items_list on public.checklist_items(checklist_id);
create index idx_itinerary_days_trip on public.itinerary_days(trip_id);
create index idx_itinerary_slots_day on public.itinerary_slots(day_id);
create index idx_ai_conversations_trip on public.ai_conversations(trip_id);
create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = auth.uid());
$$;
create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = auth.uid() and role = 'owner');
$$;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budget_items enable row level security;
alter table public.savings_entries enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_slots enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;
alter table public.entitlements enable row level security;
alter table public.paises_visto enable row level security;
create policy trips_select on public.trips for select using (is_trip_member(id));
create policy trips_insert on public.trips for insert with check (owner_id = auth.uid());
create policy trips_update on public.trips for update using (is_trip_member(id));
create policy trips_delete on public.trips for delete using (is_trip_owner(id));
create policy members_select on public.trip_members for select using (is_trip_member(trip_id));
create policy members_insert_self_owner on public.trip_members for insert with check (
  (user_id = auth.uid() and role = 'owner'
    and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
  or (user_id = auth.uid() and role = 'editor'
    and exists (select 1 from public.trip_invites i
                where i.trip_id = trip_members.trip_id and i.accepted_by = auth.uid() and i.expires_at > now()))
);
create policy members_delete on public.trip_members for delete using (is_trip_owner(trip_id) or user_id = auth.uid());
create policy invites_select on public.trip_invites for select using (is_trip_member(trip_id));
create policy invites_insert on public.trip_invites for insert with check (is_trip_owner(trip_id) and created_by = auth.uid());
create policy invites_delete on public.trip_invites for delete using (is_trip_owner(trip_id));
create or replace function public.accept_trip_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_invite public.trip_invites;
begin
  select * into v_invite from public.trip_invites where token = p_token and expires_at > now() and accepted_by is null;
  if not found then raise exception 'invite_invalid'; end if;
  update public.trip_invites set accepted_by = auth.uid() where id = v_invite.id;
  insert into public.trip_members (trip_id, user_id, role) values (v_invite.trip_id, auth.uid(), 'editor') on conflict do nothing;
  return v_invite.trip_id;
end;
$$;
create policy bc_all on public.budget_categories for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy bi_all on public.budget_items for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy se_all on public.savings_entries for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy cl_all on public.checklists for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy cli_all on public.checklist_items for all
  using (is_trip_member((select trip_id from public.checklists c where c.id = checklist_id)))
  with check (is_trip_member((select trip_id from public.checklists c where c.id = checklist_id)));
create policy itd_all on public.itinerary_days for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy its_all on public.itinerary_slots for all
  using (is_trip_member((select trip_id from public.itinerary_days d where d.id = day_id)))
  with check (is_trip_member((select trip_id from public.itinerary_days d where d.id = day_id)));
create policy aic_all on public.ai_conversations for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy aim_all on public.ai_messages for all
  using (is_trip_member((select trip_id from public.ai_conversations c where c.id = conversation_id)))
  with check (is_trip_member((select trip_id from public.ai_conversations c where c.id = conversation_id)));
create policy usage_own on public.ai_usage for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ent_select_own on public.entitlements for select using (user_id = auth.uid());
create policy templates_read on public.checklist_templates for select using (true);
create policy paises_read on public.paises_visto for select using (true);
insert into public.paises_visto (pais_iso, pais_nome, exige_visto_br, tipo_visto) values
  ('US', 'Estados Unidos', true,  'B1/B2'),
  ('CA', 'Canadá',         true,  'Visto/eTA'),
  ('AU', 'Austrália',      true,  'Visitor'),
  ('CN', 'China',          true,  'L'),
  ('IN', 'Índia',          true,  'e-Visa'),
  ('JP', 'Japão',          false, null),
  ('GB', 'Reino Unido',    false, null),
  ('PT', 'Portugal',       false, null),
  ('FR', 'França',         false, null),
  ('IT', 'Itália',         false, null),
  ('ES', 'Espanha',        false, null),
  ('AR', 'Argentina',      false, null),
  ('CL', 'Chile',          false, null),
  ('MX', 'México',         false, null);
insert into public.checklist_templates (tipo, titulo, tier, marco, ordem) values
  ('documentos', 'Passaporte válido (mínimo 6 meses após o retorno)', 'free', 90, 1),
  ('documentos', 'Passagens aéreas confirmadas', 'free', 60, 2),
  ('documentos', 'Seguro viagem contratado', 'free', 30, 3),
  ('documentos', 'Comprovante de hospedagem impresso/salvo', 'free', 15, 4),
  ('documentos', 'Cópias digitais dos documentos na nuvem', 'free', 7, 5),
  ('preparativos', 'Avisar o banco sobre a viagem', 'free', 15, 1),
  ('preparativos', 'Contratar chip internacional ou eSIM', 'free', 15, 2),
  ('preparativos', 'Verificar necessidade de vacinas', 'free', 60, 3),
  ('preparativos', 'Fazer câmbio / cartão internacional', 'free', 30, 4),
  ('mala', 'Roupas para o clima do destino', 'free', null, 1),
  ('mala', 'Adaptador de tomada universal', 'free', null, 2),
  ('mala', 'Medicamentos de uso contínuo + receitas', 'free', null, 3),
  ('mala', 'Carregadores e power bank', 'free', null, 4),
  ('compras', 'Mala/bagagem adequada às regras da cia aérea', 'free', null, 1),
  ('compras', 'Itens de higiene em tamanho de viagem', 'free', null, 2);
```
---
## 5. Fases (agrupamento macro dos tickets da seção 7)
1. **Fundação**: schema acima aplicado, rotas `/trip/*`, bottom nav, `trip-math` com testes, dashboard, wizard + clonagem de templates
2. **Financeiro**: economia mensal, orçamento por categoria, moeda dual
3. **Checklists**: 4 listas, banco de templates completo, item Visto contextual
4. **Roteiro + PDF**: dias/slots, export client-side
5. **Monetização**: entitlements, Stripe, paywall único, bônus Pro+/Vip+
6. **Colaboração + IA**: convites, membros, assistente com cotas
7. **Polimento**: PWA, instrumentação (Sentry/PostHog), LGPD, QA mobile, modo concluída + NPS
---
## 6. Protocolo de execução por ticket
1. Confirme que o ticket está desbloqueado (seção 0)
2. Abra uma issue no GitHub (repositório `mzinhoww-svg/viaja-junto-comigo`) com o corpo do ticket (título, problema, escopo IN/OUT, comportamento esperado, arquivos afetados, acceptance criteria, cenários de teste, rollout/kill switch se houver, eventos/métricas)
3. Crie branch a partir de main atualizada: `claude/vjt-xxx`
4. **Contrato antes do código**: defina assinaturas/tipos/erros da parte nova antes de implementar
5. Implemente SOMENTE o escopo do ticket. Escreva os testes no mesmo commit/PR (nunca em ticket separado)
6. QA manual simulado: percorra cada acceptance criterion como a persona P1 faria, em viewport mobile; verifique estados vazio/carregando/erro/sucesso
7. Rode lint, typecheck, testes e build localmente antes do push
8. Commit, push, abra PR contra main referenciando `Closes #N` da issue
9. Atualize a seção 0 (ticket em aberto aguardando review) e adicione entrada na seção 8 com: o que foi feito, arquivos tocados, tabelas/RLS tocadas, como testar no celular, link do PR
10. **Execução em paralelo**: se este ticket rodar simultaneamente com outros da mesma onda (sessões/ambientes separados), NÃO edite a Seção 0 nem a Seção 8 deste arquivo no seu PR — apenas descreva o resultado completo no corpo do PR e da issue. A consolidação da Seção 0 e do Log em VIAJALY-TRIP.md acontece em uma única sessão de fechamento de onda, depois que todos os PRs da onda estiverem mergeados na main
11. Pare. Não mergeie. Não inicie o próximo ticket até essa entrada ser seguida de "Mergeado" no log (o humano avisa, ou você confere o status da issue/PR na próxima sessão)
---
## 7. Backlog de tickets (19, com dependências)
Formato: **VJT-XXX Título** — Problema · Escopo IN/OUT · Aceite · Bloqueado por.
**VJT-001 ⛁ Fundação do repositório** — Sem base nada roda. IN: aplicar o schema da seção 4 no Supabase, criar rotas `/trip/*`, bottom nav, CI (lint+typecheck+testes+build), configurar Sentry. OUT: qualquer tela interna. Aceite: preview Vercel funcional; tabelas/seeds visíveis no Supabase; CI rodando. Bloqueado por: —
**VJT-002 trip-math + testes** — Fórmulas centralizadas evitam divergência. IN: módulo puro com todas as fórmulas da seção 2 + testes de todos os edge cases. OUT: UI. Aceite: 100% dos casos com teste no CI. Bloqueado por: VJT-001
**VJT-003 ⛁ Wizard de onboarding + clonagem de templates** — Sem trip não há produto. IN: wizard 4 passos (destino, data/modo sonho, viajantes, orçamento opcional), banco completo de templates (premium 80-120 itens + packs Orlando/Europa + variáveis), motor de clonagem por tier/variáveis. Aceite: trip criada em < 60s; checklists corretos para 2 combinações de variáveis. Bloqueado por: VJT-001
**VJT-004 Dashboard Sua Jornada** — Tela-âncora de retorno. IN: progresso combinado, countdown editável, stepper com critérios, atalhos, empty states; consome trip-math. Aceite: estados sonho/planejando/concluída corretos. Bloqueado por: VJT-002, VJT-003
**VJT-005 Economia mensal** — Motor de hábito mensal. IN: CRUD de registros, cards (meses restantes, sugestão, total), barra combinada, dica dinâmica. Aceite: valores batem com trip-math em cenário documentado. Bloqueado por: VJT-004
**VJT-006 Orçamento por categoria + moeda dual** — Orçamento real vive em duas moedas. IN: categorias default + CRUD, itens, donut, falta pagar, badge de estouro, câmbio manual com recálculo e aviso. Aceite: item em USD consolida em BRL; alterar câmbio recalcula tudo. Bloqueado por: VJT-004
**VJT-007 UI de checklists** — Dá interface aos dados clonados. IN: 4 listas, CRUD, marcos 90/60/30/15/7, progresso por lista e global. Aceite: marcar item atualiza o dashboard sem reload. Bloqueado por: VJT-003
**VJT-008 Roteiro dias e slots** — Módulo de maior uso perto da viagem. IN: dias auto-gerados, slots Manhã/Tarde/Noite, adicionar/remover/duplicar/reordenar/colapsar, limite free 5 dias (ponto plugável). Aceite: roteiro de 15 dias editável no celular. Bloqueado por: VJT-001
**VJT-009 Item de visto contextual** — Funil para a consultoria, sem bloquear. IN: item via `paises_visto`, card com UTM, evento `visa_cta_click`. Aceite: trip EUA exibe o card; trip Portugal não. Bloqueado por: VJT-007
**VJT-010 Export PDF do roteiro** — Gatilho de upgrade + utilidade offline. IN: PDF client-side com capa da marca, resumo e dias; botão condicionado a entitlement (mock até VJT-011). Aceite: PDF de 15 dias baixável no celular. Bloqueado por: VJT-008
**VJT-011 ⛁ Entitlements + paywall único** — Fonte única de plano. IN: hook de entitlement, modal único, 6 gatilhos aplicados, ativação manual/admin do bônus Pro+/Vip+. Aceite: free bate em todos os gatilhos implementados; flag manual libera tudo sem reload. Bloqueado por: VJT-005, VJT-006, VJT-009, VJT-010
**VJT-012 Checkout Stripe + webhook** — Receita direta. IN: checkout one-time (97/67), webhook → entitlement, idempotência por payment_id, kill switch `PAYMENTS_ENABLED`. Aceite: compra teste ativa premium sem reload; evento duplicado não duplica entitlement. Bloqueado por: VJT-011
**VJT-013 Convites e membros** — Diferencial da persona P2. IN: link mágico (7 dias), RPC `accept_trip_invite`, gestão de membros, limites por plano, kill switch `INVITES_ENABLED`. Aceite: 2 contas na mesma trip; free não convida; RLS testada contra não-membro. Bloqueado por: VJT-011
**VJT-014 Assistente IA** — Diferencial premium e motor de conversão. IN: Edge Function (Anthropic, classe Haiku), contexto da trip, cotas 10/100 com contador, escopo fechado (recusa fora do tema, redireciona visto com UTM), kill switch `AI_ENABLED` + teto diário global. Aceite: resposta usa dados reais da trip; msg 11 no free dispara paywall. Bloqueado por: VJT-011
**VJT-015 Instrumentação PostHog** — Sem eventos não há métrica. IN: PostHog integrado, 12 eventos (signup, trip_created, checklist_item_done, savings_entry_created, budget_item_created, ai_message_sent, upgrade_view, upgrade_purchase, visa_cta_click, invite_sent, invite_accepted, pdf_exported), funis grátis→compra e visto→lead. Aceite: cada evento dispara uma vez no fluxo certo. Bloqueado por: VJT-011
**VJT-016 PWA** — Instalável no celular. IN: manifest, ícones, splash. Aceite: instalado em dispositivo real. Bloqueado por: VJT-011
**VJT-017 LGPD + modo concluída + NPS** — Fecha o ciclo do produto. IN: consentimento, exclusão de conta (cascade), modo viagem concluída com NPS e CTA nova viagem. Aceite: exclusão remove dados; data passada ativa o modo. Bloqueado por: VJT-011
**VJT-018 QA mobile e performance** — Definition of done do milestone. IN: jornada P1 completa em dispositivo real, dashboard < 2s em 4G, correções pontuais. Aceite: todos os critérios de aceite anteriores re-verificados numa passada só. Bloqueado por: VJT-012, VJT-013, VJT-014, VJT-015, VJT-016, VJT-017
**VJT-019 Auditoria final do milestone** — Fecha o v1. IN: checklist cruzado desta seção 7 inteira contra o app publicado. Aceite: os 18 tickets anteriores confirmados em produção. Bloqueado por: VJT-018
---
## 8. Log de execução
> Toda tarefa concluída gera uma entrada aqui, no topo (mais recente primeiro). Sem entrada = tarefa não existe.

### 2026-07-24 — VJT-002 trip-math + testes — **Mergeado** (PR [#15](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/15), issue [#12](https://github.com/mzinhoww-svg/viaja-junto-comigo/issues/12))
- **O que foi feito**: módulo puro `src/lib/trip-math.ts` com todas as fórmulas da Seção 2 (`consolidarValorBRL`, `calcularMeta`, `calcularAcumulado`, `calcularProgressoFinanceiro`, `determinarModoTrip`, `calcularMesesRestantes`, `calcularSugestaoMensal`, `calcularProgressoChecklists`, `calcularProgressoJornada` com pesos como constantes nomeadas exportadas, `categoriaEstourada`, e o orquestrador `calcularTripMath`). Sem I/O, sem acesso a Supabase — recebe dados já carregados.
- **Arquivos novos**: `src/lib/trip-math.ts`, `src/lib/trip-math.test.ts` (44 testes, cobrindo os 5 edge cases obrigatórios: sonho, concluída, meta zero, categoria estourada, divisão por zero).
- **Tabelas/RLS**: nenhuma (módulo puro, OUT de escopo qualquer UI/persistência).
- **Execução em paralelo**: rodou em paralelo com VJT-003 e VJT-008 enquanto VJT-001 ainda aguardava merge; branch recriada a partir do `main` pós-merge de VJT-001 (via cherry-pick do commit de feature) para que o PR final ficasse só com o diff real do ticket (2 arquivos, 472 linhas). Seção 0/8 não foram editadas no PR, por regra — consolidado agora.
- **Como testar**: `bun run test` → 62/62 (44 novos + os já existentes). Sem UI para testar no celular neste ticket (VJT-004 a VJT-007 vão consumir as funções).
- **Verificação local**: lint/typecheck/test/build verdes com bun 1.3.14 (mesma versão do CI).
- **Pendências deixadas para tickets futuros**: nenhuma função ainda é consumida por UI (entra em VJT-004+).

### 2026-07-24 — VJT-008 Roteiro: dias e slots — **Mergeado** (PR [#14](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/14), issue [#13](https://github.com/mzinhoww-svg/viaja-junto-comigo/issues/13))
- **O que foi feito**: módulo puro `src/lib/itinerary.ts` (tipos `SlotPeriod`/`ItineraryDay`/`ItinerarySlot`, geração automática de `dia_numero`/`ordem`, renumeração após remoção, plano de swap para reordenar sem violar `unique(trip_id, dia_numero)`, ponto plugável do limite free `FREE_ITINERARY_DAY_LIMIT = 5`/`getItineraryDayLimit(tier)`); hook `src/hooks/useItinerary.ts` (`useCurrentTrip()` + `useItineraryDays(tripId)` + mutations de adicionar/remover/duplicar/mover dia e editar slot); UI em `src/components/trip/roteiro/` (card de dia colapsável, ações mover/duplicar/remover com confirmação, aviso de limite free); `src/routes/trip.roteiro.tsx` passou do placeholder para a tela real.
- **Arquivos novos**: `src/lib/itinerary.ts`, `src/lib/itinerary.test.ts` (23 testes), `src/hooks/useItinerary.ts`, `src/components/trip/roteiro/*`. Editado: `src/routes/trip.roteiro.tsx`.
- **Tabelas/RLS**: nenhuma migration nova — usa `itinerary_days`/`itinerary_slots` já definidas e com RLS via `is_trip_member` desde a migration do VJT-001.
- **Execução em paralelo**: rodou em paralelo com VJT-002 e VJT-003, bloqueado só por VJT-001; branch partiu de `claude/vjt-001` (só ali existiam schema/rotas/CI reais antes do merge) e foi rebaseada sobre `main` depois que VJT-001 mergeou, reduzindo o diff final ao escopo do ticket. Seção 0/8 não foram editadas no PR, por regra — consolidado agora.
- **Como testar no celular**: `/trip/roteiro` sem trip → empty state; sem dias → CTA "Adicionar Dia 1"; até 15 dias editáveis (onde ir/onde comer/observações), duplicar, remover (renumera), mover com setas, colapsar/expandir; ao atingir 5 dias no plano free, "Adicionar dia" desabilita com aviso.
- **Verificação local**: com bun 1.3.14 (igual ao CI) — lint (0 erros), typecheck (0 erros), test (23/23), build ok.
- **Pendências deixadas para tickets futuros**: export PDF (VJT-010); paywall real (VJT-011 — hoje só desabilita com aviso); cálculo automático de `data` por dia a partir de `data_viagem`.

### 2026-07-24 — VJT-001 Fundação do repositório — **Mergeado** (PR [#11](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/11))
- **O que foi feito**: schema completo do Trip versionado em migration; rotas `/trip/*` autenticadas (sessão compartilhada com o portal; sem login → redirect `/portal/login`) com bottom nav de 5 itens e placeholders; CI GitHub Actions (lint+typecheck+vitest+build via bun); Sentry no client gated por `VITE_SENTRY_DSN`; vitest com primeira suíte (`money.test.ts`). Commits de suporte: formatação prettier/eslint em 117 arquivos pré-existentes + correção de types Supabase desatualizados (`ab_events`/`ab_results`) — sem isso o CI nasceria vermelho.
- **Arquivos novos**: `supabase/migrations/20260723120000_viajaly_trip_initial_schema.sql`, `src/routes/trip.{tsx,index,financeiro,checklists,roteiro,mais}.tsx`, `src/components/trip/{BottomNav,SectionPlaceholder}.tsx`, `src/lib/sentry.ts`, `src/lib/money.test.ts`, `vitest.config.ts`, `.github/workflows/ci.yml`. Tocados: `package.json` (deps `@sentry/react`, `vitest`; scripts `typecheck`/`test`), `bun.lock`, `src/router.tsx`, `src/routeTree.gen.ts`, `src/integrations/supabase/types.ts`.
- **Tabelas/RLS**: 16 tabelas novas com RLS via `is_trip_member`/`is_trip_owner`, RPC `accept_trip_invite`, seeds `paises_visto` (14) e `checklist_templates` (15).
- **Como testar no celular**: preview Vercel do PR em 375px → `/trip` sem login redireciona; logado, bottom nav navega entre as 5 abas, cada uma com empty state + CTA.
- **Atualização 2026-07-24 (review + migration)**: revisão de código do PR #11 concluída (diff completo conferido — migration idêntica à Seção 4, rotas/gate de auth/bottom nav corretos, sem achados bloqueantes; comentário de revisão postado no PR já que a auto-aprovação do próprio autor não é permitida pelo GitHub). Migration **aplicada manualmente** via SQL Editor do dashboard Supabase (o conector desta conta não acessa `urrlqljlibpzaqnemlwf`, ver nota na Seção 3).
- **Atualização 2026-07-24 (conflito de merge + CI)**: `main` avançou em paralelo com uma feature de MCP/consent-login não relacionada, tocando os mesmos arquivos gerados (`bun.lock`, `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts`) — mergeado `main` na branch, resolvido: `types.ts` passou a usar a versão do `main` (regenerada automaticamente pelo Lovable Cloud após a migration aplicada — validado que já trazia `accept_trip_invite`/`is_trip_member`/`is_trip_owner`, prova indireta de que a migration pegou) mais os tipos de `ab_events`/`ab_results` reinseridos (o gerador do Lovable Cloud não os captura, mesmo gap que o commit original deste PR já tinha corrigido à mão); `routeTree.gen.ts` unificado com as rotas dos dois lados. Primeiro push pós-merge quebrou o CI (`bun.lock` congelado gerado num ambiente com `node_modules` residual de bun 1.3.11, inconsistente com o bun 1.3.14 que o CI resolve como "latest") — corrigido reinstalando do zero com bun 1.3.14. Isso revelou formatação que uma resolução quebrada do prettier vinha mascarando (corrigida via `eslint --fix`) e um bug real pré-existente em `main` (o redirect `?next=` do login do console tornou o parâmetro `next` obrigatório no sistema de tipos, quebrando 3 chamadas de navegação existentes) — só pego agora porque este PR é quem introduz o typecheck no CI; corrigido tornando o tipo genuinamente opcional. CI verde, PR mergeado por decisão humana.
- **Pendências deixadas para tickets futuros**: `VITE_SENTRY_DSN` manual no painel Vercel; confirmar as contagens de seed em produção (`paises_visto` = 14, `checklist_templates` = 15); telas internas (VJT-002+).