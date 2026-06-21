# Fase 2 — Catálogo & Orçamento

Objetivo: a agência cria um **caso novo em 3 passos**, o sistema gera **link + código de 6 dígitos + mensagem de WhatsApp**, e o cliente vê a **Proposta** no portal com **Aceitar / Recusar**. Sem pagamento ainda (Fase 3).

## Critérios de pronto (smoke test)

1. No console, criar um caso novo em 3 passos preenche `requests`, `request_group` (se grupo) e `travelers` (com checklist via trigger).
2. A tela final do wizard mostra **link `/portal/login`**, **código 6 dígitos** e **botão "Copiar mensagem WhatsApp"** já com o texto pronto em PT-BR.
3. Abrindo o link em aba anônima + código → cliente entra e vê a **Proposta** com itens, subtotal, descontos e total exatamente como cadastrado.
4. Cliente clica **Aceitar** → `proposal_status='accepted'` → no console o pipeline e a jornada do cliente refletem em < 2s (sem reload).
5. Cliente clica **Recusar** → abre textarea de motivo → grava em `requests.proposal_decline_reason` + `proposal_status='declined'`.
6. Recarregar qualquer tela mantém estado (verdade no banco).
7. RLS: cliente B não consegue ler proposta do cliente A (testado com 2 e-mails).

## Escopo

### Backend (migration única)

- **Tabela `proposal_items`** (linhas da proposta, derivadas mas persistidas para histórico imutável quando aceita):
  - `request_id`, `product_id` (fk `products_catalog`, nullable p/ item manual), `kind` (`visto|taxa|consultoria|extra`), `label`, `qty`, `unit_price_cents`, `discount_cents`, `sort`.
  - GRANT + RLS: `is_request_member(request_id)` p/ SELECT; INSERT/UPDATE/DELETE só admin da agência.
- **Colunas em `requests`**: `proposal_subtotal_cents`, `proposal_discount_cents`, `proposal_total_cents`, `proposal_sent_at`, `proposal_decline_reason`, `whatsapp_e164` (se ainda não existir).
- **RPC `create_request_with_travelers(payload jsonb)`** (SECURITY DEFINER, restrita a admin via `has_role`): cria `request` + `request_group` (opcional) + N `travelers` numa transação, retorna `{ request_id, access_code }`. Gera `access_code` de 6 dígitos único por agência.
- **Trigger `recompute_proposal_totals`** em `proposal_items` (AFTER INS/UPD/DEL): soma e grava nos `*_cents` da `requests`.
- Catálogo já populado na Fase 1 — apenas leitura.

### Frontend — Console (`/console`)

- Botão **"Novo orçamento"** no topo do Pipeline.
- Rota `/console/orcamento/novo` (wizard 3 passos, estado local + `useMutation` no final):
  - **Passo 1 — Cliente & viajantes**: nome, e-mail, WhatsApp (máscara BR), tipo (`individual|grupo`), lista de viajantes (nome + parentesco).
  - **Passo 2 — Itens**: combobox do `products_catalog` (Visto 1890, Taxa MRV 390, etc.) + botão "Item manual"; coluna qty, preço, desconto; subtotal/desconto/total ao vivo.
  - **Passo 3 — Revisar & enviar**: resumo + botão "Criar caso". Pós-criação mostra **card de handoff** com link, código grande copiável e botão "Copiar WhatsApp" (texto padrão Viajaly em PT-BR com link e código).
- Na ficha do cliente (`/console/cliente/:id`): aba **"Proposta"** mostrando itens + status; botão **"Reenviar mensagem"**.

### Frontend — Portal (`/portal`)

- Rota `/portal/proposta` (default do portal após login, antes de qualquer outra etapa):
  - Itens, subtotais, total, validade (se houver), bloco "Como funciona" curto.
  - Botões **Aceitar** (CTA coral) e **Recusar** (link).
  - Ao aceitar: `proposal_status='accepted'` + `proposal_sent_at`/`accepted_at`; toast + scroll p/ próxima etapa bloqueada (Contrato — Fase 3).
  - Ao recusar: drawer com textarea; grava motivo.
- `portal.index.tsx` passa a **rotear pela jornada**: se `proposal_status in (sent,viewed)` → mostra Proposta; se `accepted` mas `!contract_signed` → placeholder "Contrato (em breve)".

### Tipos & infra

- Regenerar `src/integrations/supabase/types.ts` após a migration.
- Helper `src/lib/whatsapp.ts` com `buildHandoffMessage({ name, link, code })`.
- Helper `src/lib/money.ts` (`formatBRL(cents)`).
- Server fn `src/lib/proposals.functions.ts` com `createRequest` (chama a RPC com `requireSupabaseAuth` + checagem de role admin).

## Fora de escopo (Fase 3+)

Contrato/e-sign, pagamento (Pix/cartão), DS-160, agenda, documentos, notificações por e-mail/WhatsApp automáticas. Aqui só o **texto** do WhatsApp é gerado — o envio é manual (copy/paste) por enquanto.

## Detalhes técnicos

- Wizard usa `react-hook-form` + `zod` (já no projeto via shadcn/form).
- Combobox de produto via shadcn `Command` + `Popover`.
- Totais sempre em **centavos** no banco; UI formata BRL.
- `access_code` gerado server-side dentro da RPC (loop até unique) — nunca confiar no cliente.
- Realtime já cobre: o `useRequestRealtime` da Fase 1 invalida `request` e `journey`; vou adicionar canal extra para `proposal_items` (filter `request_id=eq.<id>`).

Posso começar pela migration?
