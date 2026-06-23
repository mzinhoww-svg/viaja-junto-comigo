# Fase 5 — DS-160 + Taxas consulares

Após documentos aprovados, o portal libera duas etapas paralelas:
1. **DS-160** — formulário guiado por viajante (a equipe Viajaly preenche o oficial, mas coletamos os dados aqui).
2. **Taxas** — pagamento da taxa consular (MRV) por viajante, com instruções e confirmação.

---

## 5.1 DS-160 — Formulário guiado

Já existe a tabela `ds160_submission(traveler_id, form jsonb, completion_pct, status, package jsonb, submitted_at)` e um `document.kind='ds160'` por viajante (status `locked`).

### Backend
- **RPC `save_ds160_draft(_traveler_id uuid, _form jsonb, _completion_pct int)`** SECURITY DEFINER: valida membro da request, faz upsert do rascunho, status permanece `draft`, atualiza `updated_at`.
- **RPC `submit_ds160(_traveler_id uuid)`**: valida `completion_pct >= 100`, marca `status='received'`, `submitted_at=now()`, destrava o `documents.ds160` (status `received`).
- **RPC `validate_ds160(_traveler_id uuid, _approve boolean, _reason text)`** admin-only: marca `validated` (ou volta para `draft` com motivo registrado em `package->>'reject_reason'`); quando validado, marca `documents.ds160` como `approved`.
- `compute_journey_steps` já considera step `documentos` ok (excluindo ds160). Adicionar verificação: `documentos` step só fica `done` quando **inclusive** ds160 estiver `approved`. Ajuste minimalista no SQL.

### Schema do formulário (jsonb `form`)
Seções (espelham o DS-160 oficial, em PT-BR):
1. **Dados pessoais** — nome completo, sobrenome solteiro(a), data/local de nascimento, sexo, estado civil, nacionalidades.
2. **Endereço & contato** — endereço residencial, telefones, e-mail, redes sociais (últimos 5 anos).
3. **Passaporte** — número, data emissão/expiração, país emissor, perdas anteriores.
4. **Viagem** — propósito, datas previstas, quem paga, endereço nos EUA, companheiros.
5. **Viagens anteriores** — visitas aos EUA, vistos anteriores, recusas.
6. **Família** — pais (nome, data nascimento, status nos EUA), cônjuge, parentes nos EUA.
7. **Trabalho/Educação** — ocupação atual, empregador, salário, formação, idiomas, viagens últimos 5 anos.
8. **Segurança** — perguntas Sim/Não obrigatórias do DS-160 (saúde, criminal, etc.).

Cada seção: componente próprio `<DS160SectionX />`, validação via zod por seção, salva rascunho a cada blur. `completion_pct` calculado pelo nº de campos obrigatórios preenchidos / total.

### Frontend
- **`/portal/ds160`** — lista de viajantes (tabs). Para cada um: progress bar + accordion de seções; última seção tem botão "Enviar para a Viajaly" (chama `submit_ds160`). Após enviar, mostra "Recebido — em análise".
- **`/portal/ds160/$travelerId`** — opcional, wizard step-by-step em mobile (8 passos, "Anterior/Próximo", autosave).
- Console: aba **DS-160** na ficha do cliente, lista por viajante com:
  - Resumo do form (read-only, expandível por seção)
  - Botões "Validar" / "Solicitar correção" (modal motivo)
  - Botão "Baixar pacote" (gera JSON+PDF — apenas JSON nesta fase; PDF fica para Fase 7).

---

## 5.2 Taxas consulares (MRV)

A coluna `requests.tax_status` já existe (`pending`/`paid`).

### Decisão de modelagem
A taxa MRV é **por viajante** (US$ 185 cada). Migrar para granularidade por viajante:
- Nova tabela `tax_payments(id, traveler_id PK, amount_cents, currency, status enum('pending','paid','waived'), receipt_url, paid_at, payment_method text, notes text)`.
- Trigger no insert de `traveler` cria registro `pending` automaticamente.
- `requests.tax_status` passa a ser **derivado** (view ou função): paid quando todos os viajantes estão paid/waived. Atualizar `compute_journey_steps` para usar esse derivado.

### Backend
- **RPC `register_tax_payment(_traveler_id uuid, _receipt_url text, _method text)`**: cliente envia comprovante, status vira `paid` (pendente de validação visual pelo admin? — decisão: marca direto `paid`, admin pode reverter).
- **RPC `admin_set_tax_status(_traveler_id uuid, _status tax_status_t, _notes text)`** admin-only.
- Storage: reaproveitar bucket `documents` com prefixo `taxes/<request_id>/<traveler_id>/` ou criar bucket `receipts`. **Decisão: reaproveitar `documents`** para evitar nova migração de policies.

### Frontend
- **`/portal/taxas`** — card por viajante:
  - Instruções resumidas (link oficial CGI Federal, valor atual US$ 185, validade 1 ano).
  - Botão **"Já paguei — anexar comprovante"** (upload PDF/imagem) → chama `register_tax_payment`.
  - Estado pós-envio: badge "Recebido", botão "Trocar comprovante".
- Console: aba **Taxas** na ficha do cliente, lista por viajante, preview do comprovante, botões "Confirmar pago" / "Marcar pendente" / "Isentar".

---

## 5.3 Roteamento e Journey

`portal.index.tsx` decide próxima etapa. Atualizar lógica:
1. proposta → contrato → pagamento → documentos → **(ds160 + taxas em paralelo)** → agenda → conclusão
- Quando `documentos` (excluindo ds160) ok e pagamento paid: libera **ds160** e **taxas** simultaneamente (mostrar dois cards no `/portal`).
- Step `documentos` só vira `done` quando ds160 validado E taxas pagas (decisão alternativa: criar dois steps separados `ds160` e `taxas` na journey). **Decisão: manter chave `taxas` existente; ds160 fica embutido em `documentos` como hoje** — mais simples e respeita o array atual `['proposta','contrato','pagamento','documentos','taxas','agenda','conclusao']`.

---

## Arquivos previstos

**Migration** (`phase5_ds160_taxas.sql`):
- `CREATE TABLE tax_payments` + grants + RLS + trigger autocreate
- RPCs: `save_ds160_draft`, `submit_ds160`, `validate_ds160`, `register_tax_payment`, `admin_set_tax_status`
- Atualizar `compute_journey_steps` para derivar `tax_status` de `tax_payments` e exigir ds160 validado para `documentos`
- Realtime para `tax_payments`

**Novos:**
- `src/lib/ds160.functions.ts`
- `src/lib/taxes.functions.ts`
- `src/lib/ds160-schema.ts` — zod por seção + cálculo de `completion_pct`
- `src/routes/portal.ds160.tsx`
- `src/routes/portal.taxas.tsx`
- `src/components/viajaly/ds160/` — 8 seções (`Section1Personal.tsx` … `Section8Security.tsx`) + `DS160Form.tsx` orquestrador
- `src/components/viajaly/TaxPaymentCard.tsx`

**Editados:**
- `src/routes/console.cliente.$id.tsx` — abas DS-160 e Taxas
- `src/routes/portal.index.tsx` — roteamento p/ ds160/taxas
- `src/integrations/supabase/types.ts` (auto)

---

## Ordem de execução
1. Migration (tax_payments + RPCs + ajuste journey).
2. Backend lib (ds160 + taxes functions).
3. Frontend portal (rotas + componentes).
4. Console (abas).

Fora de escopo desta fase: PDF preenchido oficial do DS-160 (Fase 7), pagamento via Stripe/PIX direto da MRV (fluxo oficial só aceita pelo site CGI), OCR do comprovante.

Posso seguir com a migration?
