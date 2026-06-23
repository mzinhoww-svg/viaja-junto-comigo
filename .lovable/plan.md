# Fase 4 — Documentos & Fase 8 — Segurança/UX do Login

Vou implementar as duas fases na mesma rodada, em **duas migrations separadas** (uma para cada fase) e blocos de código independentes para facilitar revisão.

---

## Fase 4 — Documentos (upload + checklist por viajante)

Quando `payment_status='paid'`, o portal libera **Documentos**. Cada viajante já tem 5 docs criados via trigger (`pass`, `foto`, `renda`, `vinc`, `ds160` — esse fica `locked` para Fase 5). Cliente faz upload, admin aprova/rejeita.

### Backend
- **Storage bucket privado `documents`** com policies: cliente lê/insere/atualiza só docs da sua request (via `travelers.request_id` → `is_request_member`); admin da agência lê/atualiza tudo da agência.
- **RPC `submit_document(_doc_id uuid, _file_url text)`** SECURITY DEFINER: valida membro, grava `file_url`, marca `status='received'`, `uploaded_at=now()`, `version+1`, limpa `reject_reason`.
- **RPC `review_document(_doc_id uuid, _approve boolean, _reason text)`** SECURITY DEFINER admin-only: alterna `approved`/`rejected`, grava `reviewed_by`.
- `compute_journey_steps` já considera docs OK quando todos exceto `ds160` estão `received`/`approved` — sem mudança.

### Frontend
- `/portal/documentos` — lista por viajante, accordion ou tabs. Cada doc: nome, badge de status (pending/received/approved/rejected), botão Upload (input file), preview, botão Trocar. Se `rejected` mostra `reject_reason` em vermelho.
- Console: ficha do cliente ganha aba **Documentos** com a mesma lista + botões Aprovar/Rejeitar (modal de motivo). Realtime.
- `portal.index.tsx` roteia para `/portal/documentos` quando pagamento=paid e docs≠ok.

### Out of scope
DS-160 form/PDF (Fase 5), OCR, validação automática de documentos.

---

## Fase 8 — Segurança & UX do código de acesso

### 8.1 Expiração do código
- Coluna nova em `requests`: `access_code_expires_at timestamptz` (default `now() + interval '30 days'`).
- `loginWithCode` valida expiração e devolve erro `EXPIRED` distinto de `INVALID`.
- Login mostra mensagem clara: "Este código expirou. Solicite um novo via WhatsApp ou peça reenvio abaixo."

### 8.2 Reenvio de código
- Nova RPC `request_code_resend(_code text)` SECURITY DEFINER: aceita só códigos válidos (não-expirados), regenera novo código, marca `access_code_expires_at = now() + 30 days`, cria notificação interna (`notifications` table) para o admin/agência reenviar manualmente via WhatsApp (sem disparar mensagem ainda — futuro). Limite: 1 reenvio por 5 minutos por IP.
- Botão "Reenviar código" na tela de login. Feedback: spinner → "Pedido enviado, fale com seu consultor" + cooldown visual de 5 min.

### 8.3 Bloqueio temporário + rate-limit reforçado
- Atualizar `loginWithCode`: rate-limit por **IP** já existe; adicionar por **código tentado** (5 tentativas erradas no mesmo código em 15 min → bloqueia esse código por 30 min).
- UI: após 5 erros consecutivos no front, desabilita input com countdown ("Tente novamente em X min Y s"). Persistir o cooldown em localStorage para sobreviver a reload.
- Mensagens distintas: "Código inválido", "Código expirado", "Muitas tentativas, aguarde X min".

### 8.4 Console — auditoria de acesso
- Nova rota `/console/auditoria` (atalho no menu). Filtros: por solicitação (lead_name/email), data.
- Tabela: timestamp, e-mail (do `access_code_attempts`), IP, sucesso/falha, código tentado (mascarado: `••••12`).
- Na ficha do cliente (`/console/cliente/$id`): card "Acesso" com:
  - Código atual + cópia rápida
  - Data de geração e expiração
  - Últimas 10 tentativas (sucesso/falha + IP + horário)
  - Botão "Gerar novo código" (admin) → server fn que cria novo `access_code` único + reseta `access_code_expires_at`.
- Para suportar isso, adicionar coluna `attempted_code text` (últimos 2 dígitos só, para mascarar) em `access_code_attempts` e `request_id uuid` (nullable, preenchido quando código bate com alguma request).

### 8.5 UX do campo de código
- Auto-focus no input ao montar a tela (já feito).
- Auto-submit ao completar 6 dígitos.
- Máscara visual: 6 caixas separadas (estilo OTP), uma por dígito, com auto-avanço entre elas e paste inteligente.
- `inputMode="numeric"`, `autocomplete="one-time-code"`, `pattern="\d{6}"` para teclado numérico no mobile e suporte ao auto-preenchimento de SMS (iOS/Android).

---

## Arquivos previstos

**Migrations (2):**
- `phase4_documents.sql` — bucket + policies + RPCs.
- `phase8_access_security.sql` — colunas `requests.access_code_expires_at`, `access_code_attempts.attempted_code/request_id`, RPCs `request_code_resend`, `regenerate_access_code`.

**Novos arquivos:**
- `src/lib/documents.functions.ts`
- `src/lib/access.functions.ts` (resend + regenerate)
- `src/routes/portal.documentos.tsx`
- `src/routes/console.auditoria.tsx`
- `src/components/viajaly/OTPInput.tsx` — 6 caixas com auto-avanço/paste
- `src/components/viajaly/DocumentList.tsx` (compartilhado portal/console)
- `src/components/viajaly/AccessAuditCard.tsx` (ficha do cliente)

**Editados:**
- `src/routes/portal.login.tsx` — OTP input, reenviar, cooldown, mensagens
- `src/lib/auth.functions.ts` — expiração + códigos de erro estruturados
- `src/routes/console.cliente.$id.tsx` — abas Documentos + Acesso
- `src/routes/console.index.tsx` — link para Auditoria
- `src/routes/portal.index.tsx` — roteamento para Documentos

---

## Ordem de execução

1. Migration Fase 4 (bucket + RPCs docs).
2. Migration Fase 8 (colunas acesso + RPCs).
3. Implementação frontend (componentes + rotas + edits).

Posso aplicar as duas migrations? (vou enviar a da Fase 4 primeiro para você revisar.)
