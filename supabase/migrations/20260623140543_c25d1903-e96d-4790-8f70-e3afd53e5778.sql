-- Add Stripe session tracking on requests
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS idx_requests_stripe_session ON public.requests(stripe_session_id);

-- Idempotency table for Stripe webhook events
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
  ON public.stripe_webhook_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RPC called by the webhook (via service role) to mark payment as paid.
-- Idempotent: safe to call multiple times for the same session.
CREATE OR REPLACE FUNCTION public.mark_paid_from_stripe(
  _session_id text,
  _payment_intent_id text,
  _payment_method text,
  _amount_cents integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _req_id uuid; _existing text;
BEGIN
  SELECT id, payment_status INTO _req_id, _existing
    FROM public.requests WHERE stripe_session_id = _session_id;

  IF _req_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_found');
  END IF;

  IF _existing = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'request_id', _req_id);
  END IF;

  UPDATE public.requests
     SET payment_status = 'paid',
         payment_method = COALESCE(_payment_method, payment_method, 'card'),
         payment_amount_cents = COALESCE(_amount_cents, payment_amount_cents, proposal_total_cents),
         payment_paid_at = now(),
         stripe_payment_intent_id = COALESCE(_payment_intent_id, stripe_payment_intent_id)
   WHERE id = _req_id;

  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_req_id, 'payment_confirmed',
          'Pagamento da consultoria confirmado',
          'Pagamento confirmado via ' || COALESCE(_payment_method, 'cartão') || '. Agora é só assinar o contrato.',
          'client');

  INSERT INTO public.audit_log(actor, action, target, payload)
  VALUES (NULL, 'stripe_webhook_paid', _req_id::text,
          jsonb_build_object('session_id', _session_id, 'method', _payment_method, 'amount_cents', _amount_cents));

  RETURN jsonb_build_object('ok', true, 'request_id', _req_id);
END;
$$;

-- RPC to attach a stripe session id to a request (called from server fn)
CREATE OR REPLACE FUNCTION public.attach_stripe_session(
  _request_id uuid,
  _session_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.requests SET stripe_session_id = _session_id WHERE id = _request_id;
END;
$$;