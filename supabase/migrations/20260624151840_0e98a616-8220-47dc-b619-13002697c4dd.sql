
-- =====================================================================
-- 1) requests: remove client direct read of sensitive cols; create view
-- =====================================================================
DROP POLICY IF EXISTS requests_client_read ON public.requests;

-- Replace staff_read: scope admin to current agency
DROP POLICY IF EXISTS requests_staff_read ON public.requests;
CREATE POLICY requests_staff_read ON public.requests FOR SELECT
  TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id())
    OR (public.has_role(auth.uid(),'consultor')
        AND agency_id = (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()))
  );

-- Safe view (excludes access_code, stripe_session_id, stripe_payment_intent_id, client_signature_ip)
CREATE OR REPLACE VIEW public.requests_safe
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  id, agency_id, lead_name, lead_email, lead_phone, combo_pct, proposal_status,
  contract_signed, sign_name, signed_at, payment_method, payment_status, tax_status,
  usd_rate, usd_as_of, usd_source, sched_window_open, created_by, created_at,
  proposal_subtotal_cents, proposal_discount_cents, proposal_total_cents,
  proposal_sent_at, proposal_accepted_at, proposal_decline_reason, whatsapp_e164,
  payment_amount_cents, payment_paid_at, payment_confirmed_by, access_code_expires_at,
  visa_outcome, visa_decision_at, visa_validity_until, archived_at, client_rating,
  client_feedback, travel_checklist, passport_status, passport_notes, lead_source,
  lead_message, lead_consent_at, lead_consent_text, assigned_to, payment_installments,
  payment_card_last4, payment_attempts, combo_discount_cents, manual_discount_cents,
  visto_plan
FROM public.requests r
WHERE
  (public.has_role(auth.uid(),'admin') AND r.agency_id = public.current_agency_id())
  OR (public.has_role(auth.uid(),'consultor')
      AND r.agency_id = (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()))
  OR (lower(r.lead_email) = lower(coalesce((auth.jwt() ->> 'email'),'')));

ALTER VIEW public.requests_safe OWNER TO postgres;
GRANT SELECT ON public.requests_safe TO authenticated;
REVOKE ALL ON public.requests_safe FROM anon;

-- Client update RPC for proposal_status (accept/decline/viewed)
CREATE OR REPLACE FUNCTION public.client_set_proposal_status(_request_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('viewed','accepted','declined') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.requests
     SET proposal_status = _status,
         proposal_accepted_at = CASE WHEN _status = 'accepted' THEN now() ELSE proposal_accepted_at END,
         proposal_decline_reason = CASE WHEN _status = 'declined' THEN _reason ELSE proposal_decline_reason END
   WHERE id = _request_id
     AND proposal_status <> _status;
END $$;

-- =====================================================================
-- 2) profiles: scope admin reads to same agency
-- =====================================================================
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id())
  );

-- =====================================================================
-- 3) audit_log: scope admin reads to same agency (both branches)
-- =====================================================================
DROP POLICY IF EXISTS audit_admin_read ON public.audit_log;
CREATE POLICY audit_admin_read ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = audit_log.actor
        AND p.agency_id = public.current_agency_id()
    )
  );

-- =====================================================================
-- 4) message_templates: scope by agency
-- =====================================================================
DROP POLICY IF EXISTS templates_admin_write ON public.message_templates;
DROP POLICY IF EXISTS templates_staff_read ON public.message_templates;
CREATE POLICY templates_admin_write ON public.message_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id());
CREATE POLICY templates_staff_read ON public.message_templates FOR SELECT
  TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'consultor'))
    AND agency_id = public.current_agency_id()
  );

-- =====================================================================
-- 5) contract_templates: add agency_id, scope policies
-- =====================================================================
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE;

-- Backfill existing rows to the (single) agency
UPDATE public.contract_templates
  SET agency_id = (SELECT id FROM public.agencies ORDER BY created_at LIMIT 1)
  WHERE agency_id IS NULL;

ALTER TABLE public.contract_templates ALTER COLUMN agency_id SET NOT NULL;

-- Replace unique (scope) with unique (agency_id, scope)
ALTER TABLE public.contract_templates DROP CONSTRAINT IF EXISTS contract_templates_scope_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_templates_agency_scope_key'
  ) THEN
    ALTER TABLE public.contract_templates
      ADD CONSTRAINT contract_templates_agency_scope_key UNIQUE (agency_id, scope);
  END IF;
END $$;

DROP POLICY IF EXISTS contract_templates_admin_write ON public.contract_templates;
DROP POLICY IF EXISTS contract_templates_staff_read ON public.contract_templates;
CREATE POLICY contract_templates_admin_write ON public.contract_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id());
CREATE POLICY contract_templates_staff_read ON public.contract_templates FOR SELECT
  TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'consultor'))
    AND agency_id = public.current_agency_id()
  );

-- =====================================================================
-- 6) messages: clients cannot read internal=true
-- =====================================================================
DROP POLICY IF EXISTS messages_member ON public.messages;
CREATE POLICY messages_staff_all ON public.messages FOR ALL
  TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'consultor'))
    AND public.is_request_member(request_id)
  )
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'consultor'))
    AND public.is_request_member(request_id)
  );
CREATE POLICY messages_client_read ON public.messages FOR SELECT
  TO authenticated
  USING (
    internal = false
    AND public.is_request_member(request_id)
    AND NOT public.has_role(auth.uid(),'admin')
    AND NOT public.has_role(auth.uid(),'consultor')
  );
CREATE POLICY messages_client_insert ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    internal = false
    AND public.is_request_member(request_id)
    AND NOT public.has_role(auth.uid(),'admin')
    AND NOT public.has_role(auth.uid(),'consultor')
  );

-- =====================================================================
-- 7) contracts: clients cannot write; only sign_contract_v2 does (SECDEF)
-- =====================================================================
DROP POLICY IF EXISTS contracts_member ON public.contracts;
CREATE POLICY contracts_member_read ON public.contracts FOR SELECT
  TO authenticated
  USING (public.is_request_member(request_id));
CREATE POLICY contracts_admin_write ON public.contracts FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    AND EXISTS (SELECT 1 FROM public.requests r WHERE r.id = contracts.request_id AND r.agency_id = public.current_agency_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    AND EXISTS (SELECT 1 FROM public.requests r WHERE r.id = contracts.request_id AND r.agency_id = public.current_agency_id())
  );

-- Sanitize body_html inside sign_contract_v2 to mitigate stored XSS
CREATE OR REPLACE FUNCTION public.sign_contract_v2(_request_id uuid, _name text, _body_html text, _body_sha256 text, _ip text, _user_agent text, _accepted boolean, _cpf text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r public.requests%ROWTYPE;
  _contract_id UUID;
  _now TIMESTAMPTZ := now();
  _clean text;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT COALESCE(_accepted, false) THEN RAISE EXCEPTION 'terms_not_accepted'; END IF;
  IF _body_sha256 IS NULL OR char_length(_body_sha256) <> 64 THEN RAISE EXCEPTION 'invalid_hash'; END IF;

  SELECT * INTO r FROM public.requests WHERE id = _request_id FOR UPDATE;
  IF r.payment_status <> 'paid' THEN RAISE EXCEPTION 'payment_required'; END IF;
  IF r.contract_signed THEN RAISE EXCEPTION 'already signed'; END IF;
  IF char_length(btrim(coalesce(_name,''))) < 4 THEN RAISE EXCEPTION 'name_too_short'; END IF;

  IF encode(digest(_body_html, 'sha256'), 'hex') <> lower(_body_sha256) THEN
    RAISE EXCEPTION 'hash_mismatch';
  END IF;

  -- Server-side HTML sanitization: strip script/style/iframe/object tags and on* attrs / javascript:
  _clean := _body_html;
  _clean := regexp_replace(_clean, '<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>.*?<\s*/\s*\1\s*>', '', 'gis');
  _clean := regexp_replace(_clean, '<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*/?>', '', 'gis');
  _clean := regexp_replace(_clean, '\son[a-z]+\s*=\s*"[^"]*"', '', 'gi');
  _clean := regexp_replace(_clean, '\son[a-z]+\s*=\s*''[^'']*''', '', 'gi');
  _clean := regexp_replace(_clean, '\son[a-z]+\s*=\s*[^\s>]+', '', 'gi');
  _clean := regexp_replace(_clean, 'javascript\s*:', '', 'gi');

  INSERT INTO public.contracts(
    request_id, client, status, body_html, body_sha256,
    signed_name, signed_ip, signed_user_agent, signed_cpf,
    accepted_terms_at, signed_at
  )
  VALUES (
    _request_id, r.lead_name, 'signed', _clean, encode(digest(_clean,'sha256'),'hex'),
    btrim(_name), _ip, _user_agent, NULLIF(btrim(coalesce(_cpf,'')), ''),
    _now, _now
  )
  RETURNING id INTO _contract_id;

  UPDATE public.requests
     SET contract_signed = true,
         sign_name = btrim(_name),
         signed_at = _now,
         client_signature_ip = _ip
   WHERE id = _request_id;

  INSERT INTO public.audit_log(actor, action, target, payload)
  VALUES (
    auth.uid(),
    'contract_signed',
    _contract_id::text,
    jsonb_build_object(
      'request_id', _request_id,
      'ip', _ip,
      'user_agent', _user_agent,
      'body_sha256', encode(digest(_clean,'sha256'),'hex')
    )
  );

  RETURN jsonb_build_object(
    'contract_id', _contract_id,
    'signed_at', _now,
    'ip', _ip,
    'user_agent', _user_agent,
    'body_sha256', encode(digest(_clean,'sha256'),'hex')
  );
END $function$;

-- =====================================================================
-- 8) SECURITY DEFINER funcs: revoke from PUBLIC/anon, grant only what app needs
-- =====================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
  END LOOP;
END $$;

-- Re-grant to authenticated only the functions actually called by the app
DO $$
DECLARE fn text;
DECLARE fns text[] := ARRAY[
  'accept_invite(text)',
  'add_product_to_request(uuid, uuid, product_key_t, text)',
  'admin_set_tax_status(uuid, text)',
  'apply_usd_rate(uuid)',
  'archive_request(uuid)',
  'assign_request(uuid, uuid)',
  'attach_stripe_session(uuid, text)',
  'client_set_proposal_status(uuid, text, text)',
  'compute_journey_steps(uuid)',
  'confirm_intent(uuid, date)',
  'confirm_payment(uuid, boolean)',
  'confirm_tax_payment(uuid, boolean)',
  'create_request_with_travelers(jsonb)',
  'get_agency_billing()',
  'get_usd_rate(uuid)',
  'invite_member(text, app_role)',
  'list_contract_templates_for_request(uuid)',
  'mark_briefing_reviewed(uuid)',
  'mark_messages_read(uuid)',
  'mark_notification_read(uuid)',
  'mark_paid_from_stripe(text, text, text, integer)',
  'mark_taxes_paid_from_stripe(text, text, text, integer)',
  'pay_taxes(uuid, text)',
  'publish_milhas(uuid)',
  'publish_roteiro(uuid)',
  'regenerate_access_code(uuid)',
  'render_template(uuid, uuid)',
  'reopen_case(uuid)',
  'reopen_intent(uuid)',
  'request_code_resend(uuid)',
  'review_document(uuid, boolean, text)',
  'revoke_invite(uuid)',
  'save_briefing(uuid, text, jsonb)',
  'save_ds160_draft(uuid, jsonb, integer)',
  'save_intent_wish(uuid, date[], text, text, text)',
  'save_travel_checklist(uuid, jsonb)',
  'send_message(uuid, text, text, jsonb, boolean)',
  'set_contract_pdf_path(uuid, text)',
  'set_passport_status(uuid, text, text)',
  'set_proposal_adjustments(uuid, integer, integer)',
  'set_visa_outcome(uuid, visa_outcome_t, date)',
  'sign_contract_v2(uuid, text, text, text, text, text, boolean, text)',
  'submit_briefing(uuid, text)',
  'submit_document(uuid, text)',
  'submit_ds160(uuid)',
  'submit_feedback(uuid, integer, text)',
  'update_agency_billing(jsonb)',
  'update_agency_profile(jsonb)',
  'update_request_with_items(uuid, jsonb)',
  'upsert_emergency_contacts(jsonb)',
  'upsert_milhas(uuid, jsonb)',
  'upsert_roteiro(uuid, jsonb)',
  'upsert_schedule_window(jsonb)',
  'validate_ds160(uuid, boolean, text)'
];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip missing fn %', fn;
    END;
  END LOOP;
END $$;

-- submit_lead is the only one the public form (anon) calls
GRANT EXECUTE ON FUNCTION public.submit_lead(jsonb, text) TO anon, authenticated;
