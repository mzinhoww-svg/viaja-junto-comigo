# VIAJALY TRIP — Documento Único de Execução
> **Como usar**: coloque este arquivo na raiz do repositório `mzinhoww-svg/viaja-junto-comigo` (o mesmo do app de visto). Abra o Claude Code (Desktop, remoto ou terminal) nesse repositório e diga: **"Leia VIAJALY-TRIP.md e execute o protocolo."** Este arquivo é auto-suficiente: contém missão, regras, schema, backlog e log. Ele é reescrito por você mesmo (Claude Code) a cada ticket concluído — é sua própria memória entre sessões. Nunca crie CLAUDE.md, GUIA.md ou TICKETS.md separados: tudo vive aqui.
---
## 0. STATUS ATUAL — leia isto primeiro, sempre
| Campo | Valor |
|---|---|
| Onda atual | 1 (Fundação) + 2 (Financeiro/Checklists) + 3 (Roteiro+PDF) + 4 (Visto) fechadas — VJT-001, VJT-002, VJT-003, VJT-003b, VJT-003c, VJT-004, VJT-004b, VJT-005, VJT-006, VJT-007, VJT-007b, VJT-008, VJT-009 e VJT-010 mergeados. **Onda 5 (Monetização) iniciada**: **VJT-011** implementado nesta sessão, PR aberto aguardando review humano (não mergeado). Próximo executável só depois do merge de VJT-011: VJT-012/VJT-013/VJT-014/VJT-015/VJT-016/VJT-017 estão todos bloqueados por ele |
| Último ticket concluído (mergeado) | VJT-007b (PR [#47](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/47), issue #45, mergeado em 2026-07-25T14:08:16Z, confirmado via API do GitHub). Detalhes no Log (Seção 8) |
| Ticket em aberto aguardando review | **VJT-011** — Entitlements + paywall único (issue [#50](https://github.com/mzinhoww-svg/viaja-junto-comigo/issues/50), PR aberto contra `main`, branch `claude/optimistic-bohr-ej5h70`). Ver entrada de 2026-07-25 na Seção 8 para o escopo completo. Ticket de maior risco do backlog até agora (fonte única de plano + gatilho de monetização) — revisão humana cuidadosa recomendada antes do merge |
| Migration aplicada no Supabase | **Não verificável nesta sessão** (mesma limitação já registrada): o conector Supabase desta conta não acessa `urrlqljlibpzaqnemlwf` (Lovable Cloud). Seguem **quatro migrations pendentes de aplicação manual** via SQL Editor: VJT-001 (contagens `paises_visto`=14/`checklist_templates`=15), VJT-003/PR #19 (`checklist_templates` deveria chegar a 97 linhas; `trips.num_criancas` nova coluna), VJT-003b/PR #24 (`checklist_templates` deveria chegar a 142 linhas) e VJT-011 (`ALTER PUBLICATION supabase_realtime ADD TABLE public.entitlements` — sem essa aplicação manual, `useEntitlement()` continua funcionando via polling normal do React Query, só a invalidação em tempo real "sem reload" fica inativa até a migration ser aplicada) — nenhuma contagem confirmada em produção. VJT-005/VJT-006/VJT-007/VJT-009/VJT-010 não têm migration nova |
| `VITE_SENTRY_DSN` no Vercel | **Não verificável nesta sessão**: o conector Vercel desta conta só expõe a ferramenta de Web Analytics, sem leitura/listagem de variáveis de ambiente. Precisa checagem manual no painel Vercel (Project Settings → Environment Variables) |
| Branch `claude/vjt-003-onboarding-wizard` (do PR #18 descartado) | **Ainda não apagada**: `git push origin --delete` retornou 403 (política do proxy de git, não credencial). PR e issue já estão fechados; a branch órfã precisa ser apagada manualmente no GitHub (Settings → Branches) |
| Revisor automatizado (`.github/workflows/revisor-automatizado.yml`, Seção 6) | **Desativado (gatilho trocado para `workflow_dispatch`), baixa prioridade** — ver entrada de 2026-07-25 na Seção 8 para o diagnóstico completo (3 hipóteses tentadas, ~US$4,47 gastos, nenhum comentário real postado). Causa raiz encontrada: chamadas de rede via `Bash` (`git fetch`, `gh`, `curl`) são negadas no sandbox da `claude-code-action`, independente de `allowedTools`/`disallowedTools` — não é um problema de nome de ferramenta. Correção provável envolve o input `additional_permissions` da action (não testado). CI normal (lint/typecheck/test/build) não é afetado. Retomar só com autorização explícita do humano |
| Última atualização desta seção | 2026-07-25 (VJT-011 implementado nesta sessão — issue #50 aberta, PR criado contra `main`, aguardando review humano; ver Seção 8 para o escopo completo) |
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
**Distinção de dependência**: tickets que consomem valores agregados de trip-math (razões, percentuais, modo sonho/planejando/concluída) não dependem da completude do catálogo de checklists — a fórmula é agnóstica ao volume de itens. Só tickets que renderizam o CONTEÚDO individual dos itens (ex.: UI de checklists, packs por destino) dependem de catálogo completo. Ao definir "Bloqueado por" de um novo ticket, aplique essa distinção antes de adicionar dependência por precaução.
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
**Limitação conhecida**: exclusão de branch remota (`git push --delete`) retorna 403 nesta sessão — política do proxy de git, não é credencial. Quando um PR for fechado sem merge, deixe a branch marcada para exclusão manual pelo humano (GitHub → Branches) em vez de tentar apagar via git.
**Decisão técnica vigente (VJT-009, 2026-07-25)**: fallback WhatsApp do item de visto é o caminho único em produção até `link_consultoria` ser populado manualmente na tabela `paises_visto` — decisão aceita conscientemente, não pendência não-resolvida.
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
2. Antes de abrir uma issue nova para um ticket, busque no GitHub por issues/PRs existentes com o código do ticket no título (ex.: "VJT-003"). Se já existir, NÃO crie uma nova — continue a existente ou pare e avise, não duplique o trabalho
3. Abra uma issue no GitHub (repositório `mzinhoww-svg/viaja-junto-comigo`) com o corpo do ticket (título, problema, escopo IN/OUT, comportamento esperado, arquivos afetados, acceptance criteria, cenários de teste, rollout/kill switch se houver, eventos/métricas)
4. Crie branch a partir de main atualizada: `claude/vjt-xxx`
5. **Contrato antes do código**: defina assinaturas/tipos/erros da parte nova antes de implementar
6. Implemente SOMENTE o escopo do ticket. Escreva os testes no mesmo commit/PR (nunca em ticket separado)
7. QA manual simulado: percorra cada acceptance criterion como a persona P1 faria, em viewport mobile; verifique estados vazio/carregando/erro/sucesso
8. Rode lint, typecheck, testes e build localmente antes do push
9. Commit, push, abra PR contra main referenciando `Closes #N` da issue
10. Atualize a seção 0 (ticket em aberto aguardando review) e adicione entrada na seção 8 com: o que foi feito, arquivos tocados, tabelas/RLS tocadas, como testar no celular, link do PR
11. **Execução em paralelo**: se este ticket rodar simultaneamente com outros da mesma onda (sessões/ambientes separados), NÃO edite a Seção 0 nem a Seção 8 deste arquivo no seu PR — apenas descreva o resultado completo no corpo do PR e da issue. A consolidação da Seção 0 e do Log em VIAJALY-TRIP.md acontece em uma única sessão de fechamento de onda, depois que todos os PRs da onda estiverem mergeados na main
12. Pare. Não mergeie. Não inicie o próximo ticket até essa entrada ser seguida de "Mergeado" no log (o humano avisa, ou você confere o status da issue/PR na próxima sessão)

### Revisor automatizado
Além do CI, todo PR passa por uma sessão/rotina separada de revisão (Claude Code Remote, gatilho em PR aberto/sincronizado, nunca em comentário criado, para evitar auto-resposta). O revisor NUNCA implementa nem faz merge — só comenta no PR com achados concretos, sempre contra o diff real, nunca contra o resumo do próprio PR. Checklist obrigatório do revisor, nesta ordem:
1. Toda fórmula/agregação nova reutiliza trip-math.ts (ou o módulo puro equivalente do domínio), ou reimplementa em paralelo?
2. Se o PR toca dados que outra tela/hook também lê (ex.: budget_items, trips.cambio_manual), existe invalidação cruzada entre as queries, testada de verdade (não só argumentada)?
3. Existe issue/PR duplicado para o mesmo ticket?
4. Alguma dependência de backlog ou escopo de arquivo foi adicionada sem necessidade técnica real?
5. Edge cases da Seção 2 (modo sonho, concluída, meta zero, estouro, divisão por zero) cobertos quando o ticket os toca?

O implementador responde aos comentários do revisor na mesma branch, corrige, empurra novo commit, e pede nova revisão. Máximo 2 rodadas de revisor↔implementador; na 3ª rodada sem fechamento, o revisor para e escala para o humano com um resumo do que ainda diverge. Merge continua exclusivamente humano em qualquer cenário — o revisor não tem, e nunca deve ter, permissão de merge.
---
## 7. Backlog de tickets (19, com dependências)
Formato: **VJT-XXX Título** — Problema · Escopo IN/OUT · Aceite · Bloqueado por.
**VJT-001 ⛁ Fundação do repositório** — Sem base nada roda. IN: aplicar o schema da seção 4 no Supabase, criar rotas `/trip/*`, bottom nav, CI (lint+typecheck+testes+build), configurar Sentry. OUT: qualquer tela interna. Aceite: preview Vercel funcional; tabelas/seeds visíveis no Supabase; CI rodando. Bloqueado por: —
**VJT-002 trip-math + testes** — Fórmulas centralizadas evitam divergência. IN: módulo puro com todas as fórmulas da seção 2 + testes de todos os edge cases. OUT: UI. Aceite: 100% dos casos com teste no CI. Bloqueado por: VJT-001
**VJT-003 ⛁ Wizard de onboarding + clonagem de templates** — Sem trip não há produto. IN: wizard 4 passos (destino, data/modo sonho, viajantes, orçamento opcional), banco completo de templates (premium 80-120 itens + packs Orlando/Europa + variáveis), motor de clonagem por tier/variáveis. Aceite: trip criada em < 60s; checklists corretos para 2 combinações de variáveis. Bloqueado por: VJT-001
**VJT-003b Completar catálogo premium genérico para a faixa 80-120 itens conforme PRD** — O PR #19 (VJT-003) usa corretamente as variáveis `regiao`/`clima`/`com_crianca`/`destino_pack`, mas o bucket premium genérico fica raso: um usuário premium sem pack de destino correspondente (ex. Ásia, América do Sul) recebe hoje bem menos que a faixa 80-120 itens da Seção 2 — os packs Orlando/Europa cobrem o gap só para quem viaja para lá. IN: migration aditiva ampliando somente o bloco premium genérico (sem condição de `regiao`/`clima`/`destino_pack`) até fechar 80-120 itens totais para um usuário premium sem pack correspondente. OUT: novos packs de destino, novas variáveis, mudanças no motor de seleção (`trip-templates.ts`) ou no wizard. Aceite: cenário premium sem pack (ex. destino no Japão ou Chile) soma entre 80 e 120 itens no catálogo aplicável; teste de contagem cobrindo o cenário. Bloqueado por: VJT-003 (PR #19) — **próximo da fila assim que VJT-003 mergear**, pois bloqueia VJT-007 e VJT-009 (dependem de checklists completos para UI e regra de aceite)
**VJT-003c Validação de data passada no wizard de criação de trip** — `determinarModoTrip` (VJT-002, já mergeado e testado) já trata corretamente data no passado retornando `concluida`, mas o wizard de criação (VJT-003/PR #19) não impede nem avisa o usuário que escolhe uma data de viagem no passado — hoje isso cria a trip silenciosamente já em modo "concluída", sem nenhuma mensagem. IN: validação em `validarNovaTripInput` (`src/lib/trip-wizard.ts`) rejeitando (ou pedindo confirmação explícita para) data de viagem anterior à data atual no passo 2 do wizard. OUT: qualquer mudança em `trip-math.ts`/`determinarModoTrip` (já corretos, não tocar). Aceite: selecionar uma data passada no wizard produz mensagem de erro clara (ou confirmação explícita) em vez de criar silenciosamente uma trip "concluída"; teste unitário cobrindo o cenário. Bloqueado por: —
**VJT-004 Dashboard Sua Jornada** — Tela-âncora de retorno. IN: progresso combinado, countdown editável, stepper com critérios, atalhos, empty states; consome trip-math. Aceite: estados sonho/planejando/concluída corretos. Bloqueado por: VJT-002, VJT-003
**VJT-004b Extrair `MARCOS_CONHECIDOS` para módulo compartilhado** — O PR #25 (VJT-004) declara `MARCOS_CONHECIDOS = [90,60,30,15,7]` localmente em `src/lib/trip-journey.ts`; não é duplicação hoje (nada mais usa essa lista ainda), mas VJT-007 (UI de checklists) vai precisar do mesmo conjunto de marcos para agrupar itens por prazo, e duas constantes independentes divergem se um marco mudar no futuro. IN: mover a constante (e `labelMarco`, se fizer sentido) para um local compartilhado (ex. `trip-math.ts` ou um novo módulo de constantes de domínio) e reexportar de `trip-journey.ts`, sem alterar comportamento. OUT: qualquer nova lógica de negócio ou mudança nos marcos em si. Aceite: `trip-journey.ts` e o futuro consumo em VJT-007 importam da mesma fonte; teste garante que não há segunda lista redeclarada. Bloqueado por: VJT-004 (mergeado) — **próximo da fila**, pois bloqueia VJT-007
**VJT-005 Economia mensal** — Motor de hábito mensal. IN: CRUD de registros, cards (meses restantes, sugestão, total), barra combinada, dica dinâmica. Aceite: valores batem com trip-math em cenário documentado. Bloqueado por: VJT-004
**VJT-006 Orçamento por categoria + moeda dual** — Orçamento real vive em duas moedas. IN: categorias default + CRUD, itens, donut, falta pagar, badge de estouro, câmbio manual com recálculo e aviso. Aceite: item em USD consolida em BRL; alterar câmbio recalcula tudo. Bloqueado por: VJT-004
**VJT-007 UI de checklists** — Dá interface aos dados clonados. IN: 4 listas, CRUD, marcos 90/60/30/15/7, progresso por lista e global. Aceite: marcar item atualiza o dashboard sem reload. Bloqueado por: VJT-003, VJT-003b (catálogo premium precisa fechar a faixa 80-120 antes da UI ser considerada "dados completos"), VJT-004b (evitar redeclarar `MARCOS_CONHECIDOS` — reaproveitar a constante compartilhada)
**VJT-007b Consolidar chave de invalidação do Dashboard em `useTripChecklists.ts`** — VJT-007 (PR #39) invalida `["trip","dashboard",tripId]` como literal local em `invalidateChecklists`, em vez de importar `tripDashboardQueryKey` de `trip-query-keys.ts` (módulo criado no VJT-006b/PR #38, especificamente para eliminar esse tipo de duplicação — os dois tickets rodaram em paralelo e não convergiram). O valor bate hoje, mas é duplicação, não fonte única. IN: importar `tripDashboardQueryKey` (e, se fizer sentido, mover `invalidateChecklists` para o mesmo padrão de `invalidateFinanceiro`) em `useTripChecklists.ts`; adicionar teste de regressão para a invalidação cruzada checklists→dashboard, no mesmo padrão do teste criado em VJT-006b (`src/hooks/trip-financeiro-invalidation.test.ts`) para budget/savings/dashboard. OUT: qualquer mudança de comportamento visível ou de fórmula. Aceite: `useTripChecklists.ts` não declara mais a chave do dashboard como literal; teste de regressão cobrindo toggle/add/update/delete de item invalidando checklists+dashboard. Bloqueado por: — (sem bloqueio; PR #39 já mergeado)
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

### 2026-07-25 — Revisor automatizado (`.github/workflows/revisor-automatizado.yml`) — **Pausado, baixa prioridade** (PRs [#34](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/34), [#41](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/41), [#42](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/42) mergeados; PR [#43](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/43) fechado sem merge)
- **O que é**: workflow que implementa a subseção "Revisor automatizado" da Seção 6 — dispara só em `pull_request` (`opened`/`ready_for_review`/`synchronize`, com guard `if: draft == false`), lê VIAJALY-TRIP.md, aplica o checklist de 5 pontos contra o diff real, e deveria postar um único comentário no PR.
- **Histórico de correções aplicadas nesta sessão**: (1) PR #34 — workflow inicial; primeira run skipada pela própria validação anti-tamper da `claude-code-action` (esperado, PR introduzia o arquivo). (2) Descoberto e corrigido: secret `ANTHROPIC_API_KEY` ausente no repositório — sem ele a action falhava antes de chamar o modelo. (3) PR #41 — modelo trocado de `claude-opus-5` para `claude-sonnet-5` (custo ~40% menor), gatilho ganhou guard de draft (`ready_for_review` + `if: draft == false`, para não rodar em todo push de correção enquanto o PR ainda está em WIP), `--allowedTools` restritivo removido (hipótese: bloqueava a ferramenta de postar comentário) — run seguinte teve sucesso técnico (sonnet-5, US$1,40, sem erro) mas **nenhum comentário foi postado** (`permission_denials_count: 13`). (4) PR #42 — `show_full_output: true` ligado temporariamente para diagnosticar; run de teste (PR #43, US$0,78, 22 turnos) revelou a causa raiz real: **todas as 12 negações de permissão são chamadas `Bash` de rede (`git fetch`, `gh pr list`, `gh auth status`, `curl`, inclusive uma tentativa do próprio agente com `dangerouslyDisableSandbox: true`, também negada)** — não é, e nunca foi, uma ferramenta de comentário faltando na allowlist; é o sandbox de rede da própria `claude-code-action` bloqueando essas chamadas, independente do conteúdo de `allowedTools`/`disallowedTools`. O agente chegou a montar o comentário correto (checklist aplicado ao diff real, "sem achados") mas não conseguiu publicá-lo.
- **Custo total gasto nas 3 rodadas de diagnóstico**: US$2,29 (opus, PR #38, sem comentário) + US$1,40 (sonnet, PR #38 pós-fix parcial, sem comentário) + US$0,78 (sonnet, PR #43, `show_full_output`, sem comentário) = **US$4,47**, nenhuma delas produziu o entregável.
- **Decisão do humano**: parar por aqui. Verificação manual de PRs (como já vinha sendo feita nesta sessão, sem custo de infraestrutura) continua sendo o caminho até este workflow ser retomado.
- **Estado deixado**: workflow **desativado** (gatilho `pull_request` trocado por `workflow_dispatch` — só dispara manualmente, nunca mais sozinho em PR real) num commit final que também reverte `show_full_output` para `false`, para não continuar gastando API a cada PR sem nunca entregar o comentário. Guard de draft, modelo `claude-sonnet-5` e ausência de `--allowedTools` restritivo ficam preservados no arquivo para quando for retomado. PR #43 (veículo de teste descartável) fechado sem merge. Próxima tentativa (se/quando autorizada) deve investigar o input `additional_permissions` da `claude-code-action` para liberar rede ao `Bash`, ou trocar a estratégia de postagem de comentário para não depender de `gh`/`curl` via Bash — e então reverter o gatilho de volta para `pull_request`.

### 2026-07-25 — VJT-007b Consolidar chave de invalidação do Dashboard em useTripChecklists — **Mergeado** (PR [#47](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/47), issue #45)
- **Contexto de execução em paralelo**: rodou ao lado do VJT-009 (PR #49), conforme a Seção 6, regra 11 — escopo isolado, nenhum dos dois tocou o mesmo arquivo (VJT-007b só em `useTripChecklists.ts`; VJT-009 nunca tocou esse arquivo). Merge confirmado nesta sessão via API do GitHub (`merged: true`, `merged_at: 2026-07-25T14:08:16Z`) e via commit `4296b98` em `origin/main`, não assumido.
- **O que foi feito**: `invalidateChecklists` (`src/hooks/useTripChecklists.ts`) passa a importar `tripDashboardQueryKey` de `src/lib/trip-query-keys.ts` em vez de declarar `["trip","dashboard",tripId]` como literal local — mesma fonte única já usada por `invalidateFinanceiro`/`invalidateSavings` (VJT-006b), fechando a pendência registrada na entrada do VJT-007 acima. `invalidateChecklists` e a chave própria dos checklists (`tripChecklistsQueryKey`, antes uma função não exportada `queryKey`) agora são exportados, seguindo o padrão de `invalidateSavings`/`tripSavingsQueryKey`. Sem mudança de comportamento visível ou de fórmula — o valor invalidado já era idêntico, só a fonte da chave mudou.
- **Arquivos alterados**: `src/hooks/useTripChecklists.ts`. Novo: `src/hooks/trip-checklists-invalidation.test.ts` (teste de regressão cobrindo toggle/add/update/delete de item invalidando checklists+dashboard, e isolamento por `tripId`).
- **Tabelas/RLS**: nenhuma (refactor puro de chave de query, sem migration).
- **Verificação local (relatada no PR)**: bun — lint 0 erros, typecheck 0 erros, test 213/213 (5 novos), build ok.
- **Pendências deixadas para tickets futuros**: nenhuma — fecha o gap que motivou o ticket.

### 2026-07-25 — VJT-009 Item de visto contextual — **Mergeado** (PR [#49](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/49), issue #48)
- **Contexto de execução em paralelo**: rodou ao lado do VJT-007b (PR #47, escopo isolado — nenhum dos dois tocou o mesmo arquivo); por isso a issue/PR não editaram as Seções 0/8, consolidado agora.
- **O que foi feito**: card contextual "Visto" na lista Documentos de `/trip/checklists`, funil para a consultoria, nunca bloqueante (Seção 2). Módulo puro novo `src/lib/trip-visa.ts` (+`.test.ts`, 16 testes): `encontrarPaisVisto` casa `trips.destino_pais` (texto livre) contra `paises_visto.pais_nome` por nome normalizado (sem FK entre as tabelas); `exigeItemVisto` (type guard); `buildVisaConsultoriaLink` usa `paises_visto.link_consultoria` quando cadastrado (preserva query + UTM) ou cai no WhatsApp padrão (`@/lib/whatsapp`/`@/lib/contact`); `trackVisaCtaClick` dispara o evento `visa_cta_click` (`dataLayer`/`gtag`, mesmo padrão de `trackWhatsAppClick`).
- **Hook novo `src/hooks/useTripVistoContextual.ts`**: query key própria `["trip","paises-visto"]`, isolada de `["trip","checklists",tripId]`/`["trip","dashboard",tripId]` — não toca `useTripChecklists.ts` (responsabilidade exclusiva do VJT-007b, rodando em paralelo).
- **Componente novo `VisaContextualCard.tsx`**, plugado via prop opcional `topContent` em `ChecklistSection.tsx`/`ChecklistsDashboard.tsx`, só na lista `documentos`.
- **⚠️ Decisão de produto registrada na Seção 3**: `paises_visto.link_consultoria` está `NULL` nas 14 linhas seedadas desde o VJT-001 (nenhuma migration posterior populou a coluna) — o fallback WhatsApp é hoje o único caminho ativo do CTA, decisão aceita conscientemente pelo dono do produto, não pendência.
- **Arquivos novos**: `src/lib/trip-visa.ts`+`.test.ts`, `src/hooks/useTripVistoContextual.ts`, `src/components/trip/checklists/VisaContextualCard.tsx`. Editados: `ChecklistSection.tsx`, `ChecklistsDashboard.tsx`.
- **Tabelas/RLS**: nenhuma migration nova — só leitura de `paises_visto` via RLS pública `paises_read` já existente desde o VJT-001.
- **Verificação manual real (Playwright)**: `vite dev` + auth falsa via `localStorage` + mock stateful da rede REST do Supabase — trip com destino "Estados Unidos" exibe o card ("Visto para Estados Unidos (B1/B2)"), CTA com `href` correto (`wa.me` + UTM); trip com destino "Portugal" não exibe nada. Sem erros de console em nenhum dos dois casos.
- **Verificação local**: bun 1.3.11 — lint 0 erros, typecheck 0 erros, test 218/218 (16 novos), build ok.
- **Como testar no celular**: `/trip/checklists` com trip para destino que exige visto (EUA/Canadá/Austrália/China/Índia) → card no topo de Documentos; destino sem visto (Portugal/França/Japão) → nenhum card.
- **Pendências deixadas para tickets futuros**: popular `paises_visto.link_consultoria` com URL real via SQL Editor (hoje `NULL`, ver decisão na Seção 3); PostHog real para `visa_cta_click` (VJT-015, bloqueado por VJT-011).

### 2026-07-25 — VJT-007 UI de checklists — **Mergeado fora do fluxo normal** (PR [#39](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/39), issue #35)
- **Nota para constar historicamente**: PR #39 (VJT-007) foi mergeado nesta sessão de troubleshooting do revisor automatizado (a mesma sessão que diagnosticou o secret `ANTHROPIC_API_KEY` ausente e o modelo/gatilho/permissão do workflow `.github/workflows/revisor-automatizado.yml`), não como parte do fluxo normal de review descrito na Seção 6. O merge foi decisão humana, mas sem a etapa usual de revisão dedicada ao diff antes de aprovar — o resumo do PR foi conferido à parte, depois do merge, a pedido do humano (ver achado do VJT-007b acima, encontrado nessa conferência posterior).
- **O que foi feito**: ver corpo do PR #39 e o ticket VJT-007 na Seção 7 para o escopo completo (4 listas de checklist, `trip-checklists.ts` reaproveitando `calcularProgressoChecklists`/`MARCOS_CONHECIDOS`, `useTripChecklists.ts`, componentes em `src/components/trip/checklists/`).
- **Pendência aberta por essa conferência posterior**: VJT-007b (Seção 7) — chave de invalidação do Dashboard duplicada como literal em vez de importar `tripDashboardQueryKey`, e sem teste de regressão para checklists→dashboard.

### 2026-07-24 — VJT-006 Orçamento por categoria + moeda dual — **Mergeado** (PR [#33](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/33), issue #32)
- **Decisão de estrutura**: `/trip/financeiro` virou tela com abas (shadcn `Tabs` já existente, nenhum componente novo) — "Economia Mensal" (VJT-005, movida para dentro da aba sem nenhuma alteração de comportamento/testes) e "Orçamento por Categoria" (este ticket).
- **O que foi feito**: módulo puro novo `src/lib/trip-budget.ts` (+`.test.ts`, 38 testes) — `calcularResumoCategoria`, `calcularTotaisGerais` (delega para `calcularMeta`/`calcularAcumulado` de `trip-math.ts`, sem duplicar agregação), `calcularFaltaPagar`, `montarDadosDonut`, `itemPrecisaCambio`/`algumItemPrecisaCambio`, `validarNovaCategoria`/`validarNovoItem`, `CATEGORIAS_DEFAULT` (9 categorias do PRD), `categoriasDefaultFaltando` (comparação por nome normalizado — trim+lowercase+acentos via NFD, mesmo padrão depois reaproveitado em `trip-visa.ts`/VJT-009). Hook `useTripBudget.ts` + componentes em `src/components/trip/financeiro/budget/`.
- **Correções da 1ª revisão**: cross-invalidation entre as 3 telas do Financeiro (`invalidateFinanceiro` — Orçamento/Economia Mensal/Dashboard); paleta de categorias padrão expandida de 6 para 9; `calcularTotaisGerais` parou de duplicar a agregação do `trip-math.ts`; normalização de acento em `categoriasDefaultFaltando`.
- **Arquivos novos**: `src/lib/trip-budget.ts`+`.test.ts`, `src/hooks/useTripBudget.ts`, `src/components/trip/financeiro/budget/*`. Editado: `src/routes/trip.financeiro.tsx` (shell de abas).
- **Tabelas/RLS**: nenhuma migration nova — usa `budget_categories`/`budget_items`/`trips.moeda_destino`/`trips.cambio_manual` já existentes desde o VJT-001, mesma RLS `bc_all`/`bi_all`/`is_trip_member`.
- **Verificação manual real (Playwright)**: adicionar item com estimado R$1.200 + pago R$400 na aba Orçamento → trocar para a aba Economia Mensal sem reload → barra em 33%, "Meses restantes" e "Sugestão/mês" batendo com `trip-math.ts` para o cenário.
- **Verificação local**: bun 1.3.11 — lint 0 erros, typecheck 0 erros, test 187/187 (38 novos), build ok.
- **Como testar no celular**: `/trip/financeiro` com trip → 2 abas; "Economia Mensal" idêntica ao VJT-005; em "Orçamento por Categoria": sem categorias → CTA "Criar categorias padrão"; adicionar item, definir câmbio, estourar categoria → conferir que a outra aba reflete sem reload.
- **Pendências deixadas para tickets futuros**: paywall/limites por plano (VJT-011); instrumentação PostHog `budget_item_created` (VJT-015).

### 2026-07-24 — VJT-005 Economia mensal — **Mergeado** (PR [#31](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/31), issue #29)
- **O que foi feito**: `/trip/financeiro` (placeholder desde VJT-001) virou dashboard real de Economia Mensal — CRUD de `savings_entries` (adicionar/editar inline/remover, qualquer membro da trip via policy `se_all` já existente), 3 cards de resumo (meses restantes, sugestão mensal, total acumulado), barra combinada (acumulado/meta) e dica dinâmica (`calcularDicaEconomia`), sempre orientando, nunca bloqueando.
- **Módulo novo `src/lib/trip-savings.ts`**: conversões de `mes_ano` (`mesAnoAtual`, `mesAnoFromInputMonth`/`inputMonthFromMesAno`), `formatMesAnoLabel` (pt-BR), `calcularValorRegistradoNoMes` e `calcularDicaEconomia`. Revisado nesta sessão antes do merge: não reimplementa nenhuma fórmula de `trip-math.ts` — a dica só combina outputs já calculados (`modo`, `metaBrlCents`, `acumuladoBrlCents`, `sugestaoMensalBrlCents`) com o valor registrado no mês corrente.
- **Achado desta revisão (vira decisão pendente para VJT-006)**: `/trip/financeiro` foi construída como página de conteúdo único (`SavingsDashboard` empilha tudo verticalmente), **sem nenhuma estrutura de abas**. VJT-006 (Orçamento por categoria) vai estender a mesma rota conforme o próprio PR já anuncia, mas não há um scaffold de abas pronto para receber — vai precisar decidir entre empilhar mais uma seção vertical ou introduzir um componente de abas do zero antes de começar a implementação.
- **Arquivos novos**: `src/lib/trip-savings.ts`+`.test.ts` (24 testes), `src/hooks/useTripSavings.ts`, `src/components/trip/financeiro/{SavingsDashboard,SavingsSummaryCards,SavingsProgressBar,SavingsTip,SavingsEntryForm,SavingsEntryList}.tsx`. Editado: `src/routes/trip.financeiro.tsx`.
- **Tabelas/RLS**: nenhuma migration nova — usa `savings_entries`/`budget_items` já existentes desde VJT-001, policy `for all using (is_trip_member(trip_id))`. Erro `23505` (registro duplicado no mês) capturado e convertido em mensagem amigável.
- **Verificação local (relatada no PR)**: bun 1.3.11 — lint 0 erros, typecheck 0 erros, test 128/128 (24 novos), build ok. CI verde antes do merge.
- **Revisão antes do merge (esta sessão)**: diff completo lido arquivo a arquivo — sem achados bloqueantes, só o ponto de design do VJT-006 acima.
- **Como testar no celular**: `/trip/financeiro` sem trip → CTA "Criar minha viagem". Com trip: dica + barra + 3 cards + formulário + lista; adicionar/editar/remover registro atualiza sem reload; dois registros no mesmo mês → toast de erro amigável; modo sonho/concluída ajustam a dica.
- **Pendências deixadas para tickets futuros**: VJT-006 (orçamento por categoria + moeda dual, mesma rota — decisão de abas pendente, ver achado acima).

### 2026-07-24 — VJT-010 Export PDF do roteiro — **Mergeado** (PR [#30](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/30), issue #28)
- **O que foi feito**: botão "Exportar PDF" em `/trip/roteiro` (só aparece com ≥1 dia no roteiro). `src/lib/itinerary-pdf.ts` (novo, módulo puro + jsPDF) separa montagem de conteúdo testável (`buildItinerarySummary`, `buildDayHeading`, `buildDaySlotLines`, `itineraryPdfFileName`, `buildItineraryPdfDocument`) da geração real (`exportItineraryPdf`), seguindo o mesmo padrão visual de `travel-kit-pdf.ts` (navy/coral, helvetica, A4). Capa com marca, destino, data (ou "Data ainda não definida" em modo sonho), viajantes e total de dias; dias com quebra de página automática.
- **Ponto plugável para paywall**: `canExportItineraryPdf(tier)` em `src/lib/itinerary.ts`, mesmo padrão de `isDayLimitReached`. Revisado nesta sessão antes do merge: é um stub simples e isolado (`tier === "premium"`) — não embute lógica própria de entitlement; a checagem de plano real continua isolada no mock `CURRENT_PLAN_TIER` em `ItineraryBoard.tsx`, que VJT-011 troca por `useEntitlement()` sem tocar em `canExportItineraryPdf`.
- **Arquivos novos**: `src/lib/itinerary-pdf.ts`+`.test.ts` (27 testes). Editados: `src/lib/itinerary.ts` (+`canExportItineraryPdf`, 2 testes novos), `src/hooks/useItinerary.ts` (`useCurrentTrip()` passa a trazer `dataViagem`/`numPessoas`, aditivo), `src/components/trip/roteiro/ItineraryBoard.tsx`.
- **Tabelas/RLS**: nenhuma migration nova; `useCurrentTrip()` seleciona 2 colunas a mais de `trips`, já cobertas pela RLS `is_trip_member` existente.
- **Verificação local (relatada no PR)**: bun 1.3.11 — lint 0 erros, typecheck 0 erros, test 133/133 (29 novos), build ok (chunk `trip.roteiro` com jsPDF). CI verde antes do merge.
- **Revisão antes do merge (esta sessão)**: confirmado no diff que `canExportItineraryPdf` não reimplementa checagem de plano — sem achados.
- **Como testar no celular**: `/trip/roteiro` com dias → botão "Exportar PDF" desabilitado no mock free, com link "Recurso Premium. Conheça" para `/trip/mais`; no mock premium, baixa `roteiro-<slug>.pdf` com capa e todos os dias; modo sonho não quebra; roteiro de 15 dias gera múltiplas páginas.
- **Pendências deixadas para tickets futuros**: paywall real (VJT-011); envio por e-mail/geração server-side (fora de escopo); cálculo automático de `data` por dia (pendência já registrada no log do VJT-008); evento `pdf_exported` (VJT-015, bloqueado por VJT-011).

### 2026-07-24 — VJT-004b Extrair MARCOS_CONHECIDOS para módulo compartilhado — **Mergeado** (PR [#27](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/27), issue #26)
- **O que foi feito**: `MARCOS_CONHECIDOS`/`labelMarco` movidos de `src/lib/trip-journey.ts` para `src/lib/trip-templates.ts` (módulo de domínio dos `checklist_templates`, onde `marco` já é campo modelado); `trip-journey.ts` reexporta ambos, sem alterar nenhum comportamento — mesmos consumidores, mesmo teste existente. Novo teste de identidade de referência (`toBe`) garante que não há segunda lista redeclarada.
- **Arquivos editados**: `src/lib/trip-templates.ts`, `src/lib/trip-journey.ts`, `src/lib/trip-journey.test.ts` (1 teste novo).
- **Tabelas/RLS**: nenhuma (refactor puro, sem migration).
- **Verificação local**: bun 1.3.11 — lint 0 erros (descartadas incidentalmente 4 reformatações não relacionadas em `src/routes/[.mcp]/*`/`[.well-known]/*`, fora do escopo do ticket), typecheck 0 erros, test 114/114 (1 novo), build ok. CI verde antes do merge.
- **Revisão antes do merge (sessão seguinte, ao avaliar #30/#31)**: confirmado que nenhum dos dois PRs paralelos (#30, #31) importa de `trip-journey.ts` — sem conflito, sem achados.
- **Pendências deixadas para tickets futuros**: nenhuma — desbloqueia VJT-007 (UI de checklists), que agora pode consumir `MARCOS_CONHECIDOS`/`labelMarco` de `trip-templates.ts` sem redeclarar.

### 2026-07-24 — VJT-004 Dashboard Sua Jornada — **Mergeado** (PR [#25](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/25), issue #22)
- **O que foi feito**: tela-âncora `/trip` (antes placeholder desde VJT-001), consumindo `trip-math` (VJT-002) sobre os dados clonados pelo wizard (VJT-003). Progresso combinado (`progresso_jornada` + breakdown checklists/financeiro), countdown editável (`data_viagem` inline, inclui voltar a modo sonho), stepper de marcos 90/60/30/15/7 com contagem de itens concluídos por marco, atalhos para Financeiro/Checklists/Roteiro, e os 3 estados corretos (sonho/planejando/concluída com retrospectiva + CTA "Planejar nova viagem").
- **Módulo novo `src/lib/trip-journey.ts`**: `calcularDiasRestantes` (countdown em dias, distinto de `calcularMesesRestantes` do trip-math — granularidade e semântica diferentes) e `construirJourneySteps` (status por marco: concluído/atual/próximo/atrasado/pendente). Revisado nesta sessão antes do merge: não duplica nenhuma fórmula de `trip-math.ts`/`trip-templates.ts`; só reaproveita o tipo `TripMode` e recebe `modo` já calculado via `determinarModoTrip`.
- **Achado desta revisão (virou ticket)**: a constante `MARCOS_CONHECIDOS = [90,60,30,15,7]` é local a `trip-journey.ts` e não existe em nenhum lugar compartilhado — não é duplicação hoje (nada mais declarava essa lista antes), mas VJT-007 (UI de checklists) vai precisar do mesmo conjunto de marcos para agrupar itens por prazo, e duas listas independentes divergem com o tempo. Aberto **VJT-004b** na Seção 7 (bloqueado só por VJT-004, já mergeado) para extrair a constante antes disso acontecer — adicionado como bloqueio extra de VJT-007.
- **Arquivos novos**: `src/lib/trip-journey.ts`+`.test.ts` (16 testes), `src/hooks/useTripDashboard.ts`, `src/components/trip/dashboard/{JourneyDashboard,CountdownCard,JourneyProgressCard,JourneyStepper,ShortcutsGrid,ConcludedSummary,TripDateEditor}.tsx`. Editado: `src/routes/trip.index.tsx` (troca placeholder por `JourneyDashboard` quando há trip).
- **Tabelas/RLS**: nenhuma migration nova; só leitura de `trips`/`budget_items`/`savings_entries`/`checklists`/`checklist_items` e um `update` em `trips.data_viagem`/`status`, já cobertos pelas policies `is_trip_member`/`is_trip_owner` do VJT-001.
- **Verificação local (relatada no PR)**: bun 1.3.11 — lint 0 erros, typecheck 0 erros, test 104/104 (16 novos), build ok. CI verde antes do merge.
- **Revisão antes do merge (esta sessão)**: diff completo lido arquivo a arquivo (não só a descrição do PR) — sem achados bloqueantes.
- **Como testar no celular**: `/trip` sem viagem → empty state igual antes; criar viagem sem data → "Ainda sem data definida", sem countdown; data futura → countdown + stepper destaca o marco certo, editar recalcula sem reload; data passada → retrospectiva + CTA nova viagem; meta financeira zero → "Definir orçamento" no lugar do percentual.
- **Pendências deixadas para tickets futuros**: formulário de NPS no modo concluída (VJT-017, bloqueado por VJT-011); multi-trip real atrás do CTA "Planejar nova viagem" (VJT-011); badge de estouro de orçamento (VJT-006).

### 2026-07-24 — VJT-003b Completar catálogo premium genérico para a faixa 80-120 — **Mergeado** (PR [#24](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/24), issue #21)
- **O que foi feito**: migration aditiva `supabase/migrations/20260724180000_vjt003b_premium_catalog_generic.sql` com 45 novas linhas em `checklist_templates`, todas `tier='premium'` sem condição de `regiao`/`clima`/`destino_pack`/`com_crianca` (11 Documentos, 11 Preparativos, 12 Mala, 11 Compras). Bloco genérico premium passa de 10 para 55 itens. Nenhuma linha existente alterada.
- **Teste de contagem novo**: `src/lib/trip-templates.catalog.test.ts` parseia os `INSERT` reais das 3 migrations seedadas (VJT-001+VJT-003+VJT-003b, na ordem de aplicação) e roda `selecionarTemplates` (motor já existente, não tocado) contra o catálogo de verdade.
- **Contagens conferidas nesta sessão (recalculadas manualmente a partir do diff real, batem com o PR)**: catálogo completo = 142 linhas. Free = 30. Premium sem pack (Tóquio asia/tropical) = 93; (Santiago america_sul/frio) = 94; (NYC america_norte/frio) = 95 — todos dentro de 80-120. **Premium + pack Orlando = 106 (114 com criança); premium + pack Europa = 101 (109 com criança)** — confirma a faixa do PRD (Seção 2) para os destinos com pack.
- **Arquivos novos**: `supabase/migrations/20260724180000_vjt003b_premium_catalog_generic.sql`, `src/lib/trip-templates.catalog.test.ts`.
- **Tabelas/RLS**: `checklist_templates` ganha 45 linhas (mesma RLS de leitura pública `templates_read` desde VJT-001). Nenhuma policy nova.
- **Verificação local (relatada no PR)**: bun 1.3.11 — lint 0 erros, typecheck 0 erros, test 94/94 (5 novos de contagem), build ok. CI verde antes do merge.
- **Revisão antes do merge (esta sessão)**: contas recalculadas manualmente a partir da migration real, batem com o declarado no PR — sem achados.
- **⚠️ Pendência para o humano**: migration **não aplicada no Supabase remoto** — aplicar via SQL Editor (mesma limitação do conector já documentada). Catálogo em produção deveria chegar a 142 linhas após aplicar VJT-001+VJT-003+VJT-003b.
- **Pendências deixadas para tickets futuros**: nenhuma — este ticket fecha o gap que o motivou (VJT-007/VJT-009 agora desbloqueados).

### 2026-07-24 — VJT-003c Validação de data passada no wizard de criação de trip — **Mergeado** (PR [#23](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/23), issue #20)
- **O que foi feito**: `validarNovaTripInput` (`src/lib/trip-wizard.ts`) agora importa e reaproveita `determinarModoTrip` (`trip-math.ts`, VJT-002 — zero linhas tocadas nesse arquivo) para rejeitar data de viagem no passado com mensagem clara, em vez de criar a trip silenciosamente já em modo "concluída". Assinatura ganhou parâmetro `hoje: Date = new Date()` injetável, mesmo padrão do trip-math, para testes determinísticos. Data igual a hoje continua válida; data futura e modo sonho sem mudança de comportamento.
- **Arquivos editados**: `src/lib/trip-wizard.ts`, `src/lib/trip-wizard.test.ts` (3 novos casos: data passada rejeitada, data igual a hoje válida, data futura válida).
- **Tabelas/RLS**: nenhuma (módulo puro, sem migration).
- **Verificação local (relatada no PR)**: bun 1.3.14 — lint 0 erros, typecheck 0 erros, test 91/91 (3 novos), build ok. CI verde antes do merge.
- **Revisão antes do merge (esta sessão)**: confirmado no diff que a validação delega inteiramente para `determinarModoTrip` — não há checagem de data reimplementada à parte. Sem achados.
- **Como testar no celular**: `/trip/novo` → passo 2 → desativar modo sonho → escolher data anterior a hoje → "Avançar" → toast de erro, permanece no passo 2. Hoje ou data futura → avança normalmente.
- **Pendências deixadas para tickets futuros**: nenhuma — ticket pequeno e autocontido.

### 2026-07-24 — VJT-003 Wizard de onboarding + clonagem de templates — **Mergeado** (PR [#19](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/19), issue [#17](https://github.com/mzinhoww-svg/viaja-junto-comigo/issues/17)) — resolução da duplicidade com PR #18/issue #16
- **Contexto**: a auditoria anterior (entrada abaixo) encontrou dois PRs completos e independentes para VJT-003 (#18 e #19), nenhum mergeado. Esta sessão comparou os dois diffs de verdade (arquivos completos, não só descrição dos PRs) e decidiu qual manter.
- **Comparação PR #18 (`/trip/onboarding`, issue #16) vs PR #19 (`/trip/novo`, issue #17)**:
  - *Aderência ao PRD (Seção 2: free ~30, premium 80-120 + packs)*: #18 tem catálogo maior no bucket premium genérico (45 itens, chegando a ~93 no total com pack Orlando/Europa — dentro da faixa) mas **não popula `regiao`/`clima`** (decisão deliberada do próprio PR, colunas do schema ficam mortas). #19 usa `regiao`+`clima`+`com_crianca`+`destino_pack` como as issues pediam, mas o bucket genérico é mais raso (10 itens) e o total fica **abaixo de 80** para destinos sem pack correspondente (ex. Ásia, América do Sul) — vira ticket VJT-003b.
  - *Integração com rotas existentes (VJT-001, VJT-008)*: #19 estende o componente compartilhado `TripSectionPlaceholder` (VJT-001) com `ctaTo`/`ctaLabel` e liga o CTA em **`/trip` e `/trip/roteiro`** (VJT-008); reaproveita `determinarModoTrip` do `trip-math.ts` (VJT-002). #18 escreve um empty-state duplicado à mão só em `/trip` (não toca o roteiro) e reimplementa o cálculo de status inline (`dataViagem ? "planejando" : "sonho"`, nunca produz `concluida`) em vez de reusar `trip-math` — viola a regra de fórmulas centralizadas da Seção 2.
  - *Testes*: #19 tem 88/88 (16 em `trip-templates.test.ts` + `trip-wizard.test.ts` dedicado à validação). #18 tem 78/78, só os 16 de `trip-templates`.
  - **Decisão**: manter #19. Nada de exclusivo se perde ao descartar #18 — a filtragem por `min_duracao` já existe e está testada no motor de #19 (`templateAplica`), só falta popular dados reais (mesma lacuna documentada nos dois PRs).
- **Fechamento do PR #18/issue #16 (nesta sessão)**: comentário de justificativa postado em ambos; PR #18 fechado sem merge (`state: closed`); issue #16 fechada com `state_reason: not_planned`. **Branch `claude/vjt-003-onboarding-wizard` NÃO pôde ser apagada**: `git push origin --delete` retornou 403 (política do proxy de git desta sessão bloqueia deleção de ref remota) — fica pendente para exclusão manual (ver Seção 0).
- **O que o PR #19 mergeado entrega**: wizard de 4 passos (`/trip/novo`) com lista curada de 13 destinos + "outro destino" livre; motor de clonagem `src/lib/trip-templates.ts` (`templateAplica`/`selecionarTemplates`/`agruparEmChecklists`); migration aditiva `20260724150000_vjt003_trip_wizard.sql` (`checklist_templates` 15→97 linhas; `trips.num_criancas` nova coluna); hook `src/hooks/useCreateTrip.ts` (orquestra trip+membro+templates+orçamento opcional); CTA "Criar minha viagem" ligado em `/trip` e `/trip/roteiro`.
- **Arquivos novos**: `src/components/trip/wizard/TripWizard.tsx`, `src/hooks/useCreateTrip.ts`, `src/lib/trip-destinations.ts`, `src/lib/trip-templates.ts`+`.test.ts`, `src/lib/trip-wizard.ts`+`.test.ts`, `src/routes/trip.novo.tsx`, `supabase/migrations/20260724150000_vjt003_trip_wizard.sql`. Editados: `src/components/trip/SectionPlaceholder.tsx` (novas props `ctaTo`/`ctaLabel`), `src/components/trip/roteiro/ItineraryBoard.tsx`, `src/routes/trip.index.tsx`, `src/integrations/supabase/types.ts` (patch manual de `num_criancas`), `src/routeTree.gen.ts`.
- **Tabelas/RLS**: `trips` ganha coluna `num_criancas` (aditiva); `checklist_templates` ganha 82 linhas (mesma RLS de leitura pública já existente). Nenhuma policy nova.
- **Verificação local (relatada no PR)**: bun 1.3.14 — lint 0 erros, typecheck 0 erros, test 88/88, build ok. CI verde antes do merge.
- **⚠️ Pendência para o humano (mesmo padrão do VJT-001/VJT-008)**: migration `20260724150000_vjt003_trip_wizard.sql` **não foi aplicada no Supabase remoto** — aplicar via SQL Editor do dashboard (conector Supabase desta conta não acessa `urrlqljlibpzaqnemlwf`). `types.ts` tem só um patch manual de `num_criancas`.
- **Como testar no celular**: `/trip` sem trip → CTA "Criar minha viagem" → 4 passos (destino da lista curada ou "outro destino" livre; data ou modo sonho; viajantes+crianças; orçamento opcional, pode pular) → "Criar viagem" → volta pra `/trip` com o nome da trip. `/trip/roteiro` também oferece o mesmo CTA quando não há trip.
- **Pendências deixadas para tickets futuros**: VJT-003b (catálogo premium abaixo de 80-120 sem pack — já no backlog, próximo da fila, bloqueia VJT-007/VJT-009); VJT-003c (wizard não valida data de viagem no passado — já no backlog, desbloqueado); dashboard "Sua Jornada" (VJT-004) e UI de checklists (VJT-007) ainda consomem placeholder.

### 2026-07-24 — Auditoria de estado (verificação direta, sem suposição)
- **O que foi feito**: sessão de verificação, não de execução de ticket. Checado contra o estado real (GitHub API para PRs/issues; conectores Supabase e Vercel desta conta para dados externos), a pedido do usuário, cobrindo: quais tickets estão de fato mergeados, status de VJT-002/VJT-003, contagens de seed (`paises_visto`/`checklist_templates`) e existência de `VITE_SENTRY_DSN` no Vercel.
- **Tickets mergeados em `main` (confirmado via `merged: true` na API do GitHub, não via suposição/log antigo)**: VJT-001 (PR #11, mergeado 2026-07-24 12:20), VJT-008 (PR #14, mergeado 2026-07-24 13:15), VJT-002 (PR #15, mergeado 2026-07-24 13:49). `git log origin/main` confere com essas três mesclagens.
- **VJT-003 — duplicidade encontrada**: existem **dois PRs abertos (draft) independentes e completos** para o mesmo ticket, nenhum mergeado:
  - PR [#18](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/18) (branch `claude/vjt-003-onboarding-wizard`, closes issue #16, criada 2026-07-24 15:21) — rota `/trip/onboarding`, migration `20260724160000_checklist_templates_full_bank.sql` (15→111 linhas em `checklist_templates`, sem alterar `trips`), módulo `src/lib/trip-templates.ts` + hook `src/hooks/useTripOnboarding.ts`. CI verde (checado via API, commit `a29b15e`).
  - PR [#19](https://github.com/mzinhoww-svg/viaja-junto-comigo/pull/19) (branch `claude/vjt-003-wizard-onboarding`, closes issue #17, criada 2026-07-24 15:26) — rota `/trip/novo`, migration `20260724150000_vjt003_trip_wizard.sql` (15→97 linhas em `checklist_templates` + `alter table trips add column num_criancas`), módulo `src/lib/trip-templates.ts` + `src/lib/trip-wizard.ts`/`trip-destinations.ts` + hook `src/hooks/useCreateTrip.ts`. CI verde (checado via API, commit `e5241ae`).
  - As duas sessões rodaram em paralelo sem se ver: issue #16 (15:21) → issue #17 (15:26, 5min depois) → PR #18 (15:32) → PR #19 (15:34, 2min depois). **Nenhum dos dois foi mergeado, fechado ou alterado por esta sessão de auditoria** — escolher qual manter (ou reconciliar/combinar as duas abordagens) é decisão humana. Mergear qualquer um dos dois sem reconciliar o outro provavelmente gera conflito ou trabalho duplicado no schema (`checklist_templates`/`trips`).
- **Contagens de seed (`paises_visto`=14, `checklist_templates`=15) — não verificado**: sem acesso via conector. `mcp__Supabase__list_projects` desta conta só retorna `crm-ai-studio`, `supabase-purple-book` e `the-loyalty` — nenhum é o projeto `urrlqljlibpzaqnemlwf` usado por este app (gerenciado pelo Lovable Cloud, fora do alcance do conector). Sem uma consulta SQL direta, essas contagens continuam **não confirmadas** (nem contra os 15 originais do VJT-001, nem contra os 111/97 propostos pelos PRs duplicados do VJT-003, já que nenhum dos dois foi mergeado).
- **`VITE_SENTRY_DSN` no Vercel — não verificado**: o conector Vercel desta conta só expõe `get_web_analytics`; não há ferramenta para listar/ler variáveis de ambiente do projeto. Precisa checagem manual no painel (Project Settings → Environment Variables).
- **Ação tomada**: apenas atualização da Seção 0 e desta entrada de log, refletindo o estado real encontrado. Nenhum código, PR, merge ou dado do Supabase/Vercel foi alterado nesta sessão.
- **Pendências para a próxima sessão/humano**: (1) decidir entre PR #18/#19 (ou reconciliar) antes de qualquer nova execução que dependa de VJT-003 mergeado (ex.: VJT-004, VJT-007); (2) confirmar as contagens de seed via SQL Editor do dashboard Supabase; (3) confirmar `VITE_SENTRY_DSN` no painel Vercel.

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