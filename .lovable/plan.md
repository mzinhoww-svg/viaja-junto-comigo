# Fase 6 — Agendamentos (CASV / Entrevista / PF)

Após documentos e taxas ok, o portal libera **Agenda**. Cada viajante precisa de até 3 agendamentos: CASV (biometria), Entrevista (consulado) e PF (Polícia Federal — passaporte brasileiro, opcional por solicitação).

Fluxo simétrico ao restante do app: cliente expressa desejo → admin libera janelas disponíveis e confirma datas → cliente vê confirmação em tempo real.

---

## 6.1 Modelagem

Aproveitamos as tabelas existentes:
- `schedule_intents(traveler_id, service, wish, status, confirmed_date)` — 1 linha por (viajante, serviço).
- `schedule_window(agency_id, released_quinzenas jsonb, slots jsonb)` — janelas que a agência publicou.

### Ajustes mínimos
- Adicionar colunas em `schedule_intents`: `wish_dates date[]` (lista de datas preferidas), `wish_period text` (manhã/tarde/qualquer), `consulate text` (SP/RJ/BSB/POA/REC), `notes text`.
- Atualizar trigger `create_traveler_defaults` para criar 3 linhas (`casv`, `entrevista`, `pf`) status `open` por viajante.
- Backfill: criar intents faltantes para viajantes existentes.

### Estrutura do `schedule_window.slots`
```json
{
  "casv":       { "SP": ["2026-07-14", "2026-07-15", ...] },
  "entrevista": { "SP": ["2026-07-21", ...] },
  "pf":         { "POA": ["2026-07-10", ...] }
}
```
Admin gerencia via UI (adicionar/remover datas por serviço+consulado).

---

## 6.2 Backend

RPCs novas:
- **`save_intent_wish(_intent_id, _wish_dates date[], _wish_period text, _consulate text, _notes text)`** — cliente expressa preferência; status passa para `sent`.
- **`confirm_intent(_intent_id, _confirmed_date date, _consulate text)`** admin-only — status `confirmed`, grava data + consulado, registra `confirmed_by`. Notificação interna.
- **`reopen_intent(_intent_id)`** admin-only — volta status para `open`.
- **`upsert_schedule_window(_slots jsonb, _released jsonb)`** admin-only — atualiza janelas da agência.

Atualizar `compute_journey_steps`: step `agenda` fica `done` quando todas as intents `required` da request estão `confirmed`. (Intent `pf` é opcional — não bloqueia.) Adicionar coluna `required boolean` em `schedule_intents` ou marcar PF como sempre opcional via service check.

**Decisão:** PF é sempre opcional. Lógica: `agenda_ok = NOT EXISTS intent IN ('casv','entrevista') WITH status <> 'confirmed'`.

---

## 6.3 Frontend — Portal

**`/portal/agenda`** — Por viajante (tabs se >1), card por serviço:

```text
┌─ CASV ───────────────────────── [status] ┐
│ Consulado: [SP ▾]                         │
│ Preferência: [Manhã/Tarde/Qualquer ▾]     │
│ Datas que funcionam (selecione até 3):    │
│  [calendário multi-select limitado às     │
│   datas liberadas em slots[serviço][cons]]│
│ Observações: [textarea]                   │
│ [Salvar preferência]                      │
└───────────────────────────────────────────┘
```

Quando `status='confirmed'`: card vira verde com data confirmada grande + consulado + ícone de calendário. Botão "Adicionar ao Google Calendar" (link `https://calendar.google.com/calendar/r/eventedit?...`).

PF é card secundário, recolhível, com badge "opcional".

Se a agência ainda não liberou janelas: mostrar mensagem "Aguardando a Viajaly liberar as datas — você será notificado."

---

## 6.4 Frontend — Console

**Ficha do cliente** ganha aba **Agenda**:
- Lista por viajante × serviço com: status, preferência do cliente, datas desejadas, consulado pedido.
- Botão **"Confirmar data"** abre modal com date picker + select de consulado → chama `confirm_intent`.
- Botão **"Reabrir"** para desfazer.

**Nova rota `/console/agenda`** (atalho no menu): visão agregada da agência.
- Calendário mensal com todos os agendamentos confirmados (cor por serviço).
- Filtros: serviço, consulado, cliente.
- Painel lateral "Pendentes de confirmação" (intents `sent`) ordenado por data de criação.

**Nova rota `/console/janelas`** (atalho no menu): editor de `schedule_window`.
- Por serviço (CASV/Entrevista/PF) × consulado: lista de datas disponíveis com botão `+ Adicionar data` e `×` por chip.
- Apenas datas futuras. Salva via `upsert_schedule_window`.

---

## 6.5 Rotas e roteamento

- `portal.index.tsx`: adicionar quick link **Agenda** ao grid de etapas pós-pagamento (junto com DS-160 e Taxas), exibido quando docs e taxas ok.
- `portal.agenda.tsx` (novo).
- `console.agenda.tsx` (novo).
- `console.janelas.tsx` (novo).
- Aba Agenda em `console.cliente.$id.tsx`.

---

## Arquivos previstos

**Migration** (`phase6_agenda.sql`):
- ALTER `schedule_intents` (wish_dates, wish_period, consulate, notes).
- Atualizar `create_traveler_defaults` (3 intents por viajante).
- Backfill intents para viajantes existentes.
- RPCs: `save_intent_wish`, `confirm_intent`, `reopen_intent`, `upsert_schedule_window`.
- `compute_journey_steps` ajustada (PF opcional).
- Realtime para `schedule_window`.

**Novos:**
- `src/lib/schedule.functions.ts`
- `src/routes/portal.agenda.tsx`
- `src/routes/console.agenda.tsx`
- `src/routes/console.janelas.tsx`
- `src/components/viajaly/ScheduleIntentCard.tsx` (compartilhado portal/console)
- `src/components/viajaly/ScheduleWindowEditor.tsx`
- `src/components/viajaly/AgencyCalendar.tsx` (calendário mensal agregado)

**Editados:**
- `src/routes/portal.index.tsx` (quick link Agenda).
- `src/routes/console.cliente.$id.tsx` (aba Agenda).
- `src/routes/console.tsx` (links Agenda/Janelas no menu).

---

## Ordem de execução
1. Migration (colunas + RPCs + journey).
2. Backend lib (server functions).
3. Editor de janelas (admin) → necessário para o cliente ter o que escolher.
4. Portal `/portal/agenda` + card.
5. Console: aba na ficha + visão agregada.

**Fora de escopo:** integração real com sistema do consulado (impossível por API), envio automático de WhatsApp com confirmação (Fase 7), sincronização nativa com Google Calendar (mantemos só o link `calendar.google.com`).

Posso seguir com a migration?
