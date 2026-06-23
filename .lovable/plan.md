# Fase 3 — Contrato, Aceite Digital & Pagamento Pix

Quando a Proposta vira `accepted`, libera **Contrato** (geração + aceite digital com nome/IP). Aceite libera **Pagamento Pix** (QR + copia-e-cola). Confirmação manual no console destrava as próximas etapas. **Sem gateway real** nesta fase — Pix é gerado como código estático (chave da agência + valor) e admin confirma o recebimento; estrutura pronta para plugar Mercado Pago/Asaas depois.

## Critérios de pronto

1. Aceitar proposta → portal mostra **"Contrato"** ativo; demais etapas seguem locked.
2. Cliente abre Contrato → vê PDF/HTML renderizado com nome, viajantes, itens e valor.
3. Cliente digita o nome completo + marca checkbox + clica "Assinar" → `contracts.status='signed'`, `requests.contract_signed=true`, `sign_name`, `signed_at`, IP gravado.
4. Pagamento desbloqueia automaticamente; tela mostra **QR Pix** + **copia-e-cola** + valor + instruções; status inicial `pending`.
5. Cliente clica "Já paguei" → `payment_status='processing'` (informativo).
6. Console: ficha do cliente tem aba **Pagamento** com botões **Confirmar recebimento** (→ `paid`) e **Estornar** (→ `pending`). Mudança em <2s no portal via realtime.
7. Recarregar mantém estado. Cliente B não vê contrato/pagamento de A (RLS via `is_request_member`).
8. `compute_journey_steps` já reflete contrato (etapa 2) e pagamento (etapa 3) — sem mudança de RPC.

## Escopo

### Backend (migration única)

- **Colunas em `requests`**: `pix_key`, `pix_key_type` (`cpf|cnpj|email|phone|random`), `payment_amount_cents` (snapshot do total no aceite do contrato), `payment_paid_at`, `payment_confirmed_by`, `client_signature_ip`.
- **Colunas em `agencies`**: `pix_key`, `pix_key_type`, `pix_merchant_name`, `pix_merchant_city` (para gerar BR Code). Sem UI de edição agora — seed via migration com dados da Viajaly demo.
- **Tabela `contracts`** já existe — adicionar colunas: `body_html` (texto renderizado no momento do aceite, imutável), `signed_name`, `signed_ip`, `signed_at`. Enum `contract_status_t` já cobre `draft|sent|signed`.
- **RPC `sign_contract(_request_id uuid, _name text, _ip text)`** SECURITY DEFINER: valida que caller é membro, valida proposta=accepted, gera/atualiza linha em `contracts` com `body_html` snapshot, marca `requests.contract_signed=true`, `sign_name`, `signed_at`, copia `proposal_total_cents` → `payment_amount_cents`.
- **RPC `confirm_payment(_request_id uuid, _paid boolean)`** SECURITY DEFINER, admin only: alterna `payment_status` entre `paid` e `pending`, grava `payment_paid_at`/`payment_confirmed_by`.
- GRANTs e RLS já cobertos por `contracts_member` / `requests_*`.

### Frontend

**Lib novas:**
- `src/lib/pix.ts` — gera BR Code EMV estático (payload Pix copia-e-cola) com CRC16. Sem dependência externa.
- `src/lib/contract-template.ts` — `renderContract({ agency, client, travelers, items, total })` retorna HTML PT-BR (cláusulas básicas Viajaly: objeto, valor, prazo, cancelamento, LGPD).
- `src/lib/contracts.functions.ts` — `signContract` + `confirmPayment` (createServerFn + requireSupabaseAuth).

**Portal:**
- `/portal/contrato` — preview do contrato (HTML), input nome completo, checkbox "Li e concordo", botão Assinar (coral). Após assinado: estado read-only com banner "Assinado em ...".
- `/portal/pagamento` — card com valor, QR Code (gerado via `qrcode` npm), copia-e-cola com botão copiar, instruções, botão "Já fiz o Pix" (→ processing) + "Aguardando confirmação". Estado `paid` mostra ✓ verde.
- `portal.index.tsx` roteia: `proposal!=accepted` → /proposta; `!contract_signed` → /contrato; `payment_status!=paid` → /pagamento; else placeholder Documentos.

**Console:**
- Ficha do cliente: abas **Proposta | Contrato | Pagamento**. Contrato mostra status + preview. Pagamento mostra valor, status, botões Confirmar/Estornar.

**Realtime:** `useRequestRealtime` já cobre `requests` (status muda lá).

**Pacote a instalar:** `qrcode` (gerar PNG do BR Code no client).

## Fora de escopo (Fase 4+)

Gateway Pix real (Mercado Pago/Asaas webhook), cartão de crédito, parcelamento, comprovante upload, e-mail automático de confirmação, DS-160, agendamento. Contrato em PDF real (jspdf) — por ora HTML imprimível.

## Detalhes técnicos

- Pix BR Code montado em JS puro (TLV + CRC16-CCITT). Validado contra spec do Banco Central; gera string `00020126...6304XXXX`.
- `body_html` salvo no aceite é a **verdade jurídica** — não recalcula depois (mesmo padrão "snapshot" da proposta).
- IP capturado server-side via `request.headers` no createServerFn.
- Valor congelado em `payment_amount_cents` no aceite — mesmo que items mudem depois.

Posso aplicar a migration?
