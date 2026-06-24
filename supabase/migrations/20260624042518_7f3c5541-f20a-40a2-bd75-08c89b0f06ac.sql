
-- 1) Fix function search_path on the 3 trigger functions
ALTER FUNCTION public.enforce_visa_disclaimer_core() SET search_path = public;
ALTER FUNCTION public.touch_product_briefings_updated() SET search_path = public;
ALTER FUNCTION public.touch_schedule_intents_updated() SET search_path = public;

-- 2) Revoke EXECUTE on all public functions from PUBLIC and anon; grant to authenticated;
--    re-grant anon only on the two functions that must accept unauthenticated calls.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
-- Public form posts leads anonymously
GRANT EXECUTE ON FUNCTION public.submit_lead(jsonb, text) TO anon;
-- service_role retains full access
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Default privileges for any future function in public
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT  EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT  EXECUTE ON FUNCTIONS TO service_role;

-- 3) access_code_attempts: remove redundant broad admin policy; tighten anon insert
DROP POLICY IF EXISTS ac_attempts_admin_read ON public.access_code_attempts;

DROP POLICY IF EXISTS ac_attempts_anyone_insert ON public.access_code_attempts;
CREATE POLICY ac_attempts_anyone_insert
  ON public.access_code_attempts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) > 0
    AND length(email) <= 320
    AND (attempted_code IS NULL OR attempted_code ~ '^[0-9]{4,8}$')
  );

-- 4) agency_invites: scope admin access to current agency
DROP POLICY IF EXISTS invites_admin_all ON public.agency_invites;
CREATE POLICY invites_admin_all
  ON public.agency_invites
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id());

-- 5) audit_log: scope admin reads to entries whose actor belongs to the same agency
DROP POLICY IF EXISTS audit_admin_read ON public.audit_log;
CREATE POLICY audit_admin_read
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    AND (
      actor = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = audit_log.actor
          AND p.agency_id = public.current_agency_id()
      )
    )
  );

-- 6) product_briefings: explicit write policy — admins only. Clients should not write directly.
DROP POLICY IF EXISTS briefings_admin_write ON public.product_briefings;
CREATE POLICY briefings_admin_write
  ON public.product_briefings
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = product_briefings.request_id
        AND r.agency_id = public.current_agency_id()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = product_briefings.request_id
        AND r.agency_id = public.current_agency_id()
    )
  );

-- 7) contract_templates: tighten read to staff; expose to clients via SECURITY DEFINER RPC
DROP POLICY IF EXISTS contract_templates_read ON public.contract_templates;
CREATE POLICY contract_templates_staff_read
  ON public.contract_templates
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'consultor'));

CREATE OR REPLACE FUNCTION public.list_contract_templates_for_request(_request_id uuid)
RETURNS TABLE (scope text, body_html text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.scope, t.body_html
  FROM public.contract_templates t
  WHERE public.is_request_member(_request_id);
$$;
REVOKE EXECUTE ON FUNCTION public.list_contract_templates_for_request(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_contract_templates_for_request(uuid) TO authenticated;

-- 8) agencies: hide PIX credentials from non-admin staff via column-level revoke + admin RPC
REVOKE SELECT (pix_key, pix_key_type, pix_merchant_name, pix_merchant_city)
  ON public.agencies FROM authenticated;
REVOKE SELECT (pix_key, pix_key_type, pix_merchant_name, pix_merchant_city)
  ON public.agencies FROM anon;

CREATE OR REPLACE FUNCTION public.get_agency_billing()
RETURNS TABLE (
  pix_key text,
  pix_key_type text,
  pix_merchant_name text,
  pix_merchant_city text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.pix_key, a.pix_key_type, a.pix_merchant_name, a.pix_merchant_city
  FROM public.agencies a
  WHERE a.id = public.current_agency_id()
    AND public.has_role(auth.uid(),'admin');
$$;
REVOKE EXECUTE ON FUNCTION public.get_agency_billing() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_agency_billing() TO authenticated;

-- 9) requests: hide truly-internal payment identifiers from authenticated readers.
--    Admin webhook uses service_role and is unaffected.
REVOKE SELECT (stripe_session_id, stripe_payment_intent_id, client_signature_ip)
  ON public.requests FROM authenticated;
REVOKE SELECT (stripe_session_id, stripe_payment_intent_id, client_signature_ip)
  ON public.requests FROM anon;
