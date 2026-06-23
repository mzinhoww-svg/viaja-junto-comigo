# Fase 5 — DS-160 + Taxas consulares (concluída)

## Backend
- Tabela `tax_payments` (por viajante) + RLS por membership + trigger autocreate.
- RPCs: `save_ds160_draft`, `submit_ds160`, `validate_ds160`, `register_tax_payment`, `admin_set_tax_status`, `refresh_request_tax_status`.
- `compute_journey_steps` atualizada: step **documentos** exige DS-160 validado; step **taxas** derivado de `tax_payments` de todos os viajantes.

## Frontend
- `/portal/ds160` — wizard com 8 seções, autosave (800ms), progress %, envio quando 100%.
- `/portal/taxas` — card por viajante com link oficial CGI Federal e upload de comprovante.
- Hub `/portal` — quick links DS-160 + Taxa MRV após pagamento; StepCards clicáveis.
- Console — abas DS-160 e Taxas na ficha do cliente (validar/recusar, confirmar/isentar).

## Fases restantes
- Fase 6: Agendamentos (window + intent + confirmação).
- Fase 7: Conclusão & extras (PDF DS-160, comunicados pós-visto).
