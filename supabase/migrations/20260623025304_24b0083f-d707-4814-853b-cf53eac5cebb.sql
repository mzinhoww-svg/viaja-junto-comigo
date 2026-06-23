
-- requests.assigned_to
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON public.requests(assigned_to);

-- agency_invites
CREATE TABLE IF NOT EXISTS public.agency_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'consultor',
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_agency_invites_agency ON public.agency_invites(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_invites_email ON public.agency_invites(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_invites TO authenticated;
GRANT ALL ON public.agency_invites TO service_role;
ALTER TABLE public.agency_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invites_admin_all" ON public.agency_invites;
CREATE POLICY "invites_admin_all" ON public.agency_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- message_templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'geral',
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_agency ON public.message_templates(agency_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_staff_read" ON public.message_templates;
CREATE POLICY "templates_staff_read" ON public.message_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'consultor'));

DROP POLICY IF EXISTS "templates_admin_write" ON public.message_templates;
CREATE POLICY "templates_admin_write" ON public.message_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.touch_message_templates_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_templates_updated_at ON public.message_templates;
CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_message_templates_updated_at();

-- log_audit helper
CREATE OR REPLACE FUNCTION public.log_audit(_action text, _target text, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log(actor, action, target, payload)
  VALUES (auth.uid(), _action, _target, _payload);
END $$;
REVOKE EXECUTE ON FUNCTION public.log_audit(text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text,text,jsonb) TO authenticated;

-- invite_member
CREATE OR REPLACE FUNCTION public.invite_member(_email text, _role public.app_role)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency uuid; _token text; _id uuid; _norm text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _role NOT IN ('admin','consultor') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  _norm := lower(btrim(COALESCE(_email,'')));
  IF _norm = '' OR _norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'email_invalido'; END IF;
  SELECT agency_id INTO _agency FROM public.profiles WHERE id = auth.uid();
  IF _agency IS NULL THEN RAISE EXCEPTION 'no_agency'; END IF;
  _token := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.agency_invites(agency_id, email, role, token, invited_by)
  VALUES (_agency, _norm, _role, _token, auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.audit_log(actor, action, target, payload)
  VALUES (auth.uid(), 'invite_created', _id::text, jsonb_build_object('email',_norm,'role',_role));
  RETURN jsonb_build_object('ok', true, 'id', _id, 'token', _token);
END $$;
REVOKE EXECUTE ON FUNCTION public.invite_member(text, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_member(text, public.app_role) TO authenticated;

-- revoke_invite
CREATE OR REPLACE FUNCTION public.revoke_invite(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.agency_invites SET revoked_at = now()
   WHERE id = _id AND revoked_at IS NULL AND accepted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  INSERT INTO public.audit_log(actor, action, target, payload)
  VALUES (auth.uid(), 'invite_revoked', _id::text, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.revoke_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_invite(uuid) TO authenticated;

-- accept_invite
CREATE OR REPLACE FUNCTION public.accept_invite(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.agency_invites%ROWTYPE; _uid uuid; _user_email text;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO _inv FROM public.agency_invites WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invite_revoked'; END IF;
  IF _inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invite_used'; END IF;
  IF _inv.expires_at < now() THEN RAISE EXCEPTION 'invite_expired'; END IF;
  SELECT lower(email) INTO _user_email FROM auth.users WHERE id = _uid;
  IF _user_email IS DISTINCT FROM lower(_inv.email) THEN RAISE EXCEPTION 'email_mismatch'; END IF;

  UPDATE public.profiles
     SET role = _inv.role, agency_id = _inv.agency_id
   WHERE id = _uid;
  IF NOT FOUND THEN
    INSERT INTO public.profiles(id, role, agency_id, email)
    VALUES (_uid, _inv.role, _inv.agency_id, _user_email);
  END IF;

  UPDATE public.agency_invites
     SET accepted_at = now(), accepted_by = _uid
   WHERE id = _inv.id;

  INSERT INTO public.audit_log(actor, action, target, payload)
  VALUES (_uid, 'invite_accepted', _inv.id::text, jsonb_build_object('role',_inv.role));
  RETURN jsonb_build_object('ok', true, 'role', _inv.role);
END $$;
REVOKE EXECUTE ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

-- assign_request
CREATE OR REPLACE FUNCTION public.assign_request(_request_id uuid, _assignee uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.requests SET assigned_to = _assignee WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  INSERT INTO public.audit_log(actor, action, target, payload)
  VALUES (auth.uid(), 'request_assigned', _request_id::text, jsonb_build_object('assignee',_assignee));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.assign_request(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_request(uuid, uuid) TO authenticated;

-- render_template
CREATE OR REPLACE FUNCTION public.render_template(_template_id uuid, _request_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _body text; _r public.requests%ROWTYPE; _first text; _portal text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'consultor')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT body INTO _body FROM public.message_templates WHERE id = _template_id;
  IF _body IS NULL THEN RAISE EXCEPTION 'template_not_found'; END IF;
  SELECT * INTO _r FROM public.requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  _first := split_part(COALESCE(_r.lead_name,''), ' ', 1);
  _portal := 'https://viaja-junto-comigo.lovable.app/portal/login?code=' || COALESCE(_r.access_code,'');
  _body := replace(_body, '{{nome}}', COALESCE(_r.lead_name,''));
  _body := replace(_body, '{{primeiro_nome}}', _first);
  _body := replace(_body, '{{codigo_acesso}}', COALESCE(_r.access_code,''));
  _body := replace(_body, '{{link_portal}}', _portal);
  RETURN _body;
END $$;
REVOKE EXECUTE ON FUNCTION public.render_template(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.render_template(uuid, uuid) TO authenticated;

-- Consultor pode ler requests da própria agência
DROP POLICY IF EXISTS "requests_staff_read" ON public.requests;
CREATE POLICY "requests_staff_read" ON public.requests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR (
      public.has_role(auth.uid(),'consultor')
      AND agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Seed templates iniciais (idempotente)
INSERT INTO public.message_templates(agency_id, category, title, body)
SELECT a.id, 'boas-vindas', 'Boas-vindas',
$msg$Oi {{primeiro_nome}}! 👋

Recebemos seu pedido e já estamos preparando tudo. Acesse seu portal aqui: {{link_portal}}
Código de acesso: {{codigo_acesso}}

Qualquer dúvida, é só responder por aqui.$msg$
FROM public.agencies a
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates t WHERE t.agency_id = a.id AND t.title = 'Boas-vindas'
);

INSERT INTO public.message_templates(agency_id, category, title, body)
SELECT a.id, 'pagamento', 'Lembrete de pagamento',
$msg$Oi {{primeiro_nome}}, tudo bem?

Notei que o pagamento ainda não foi confirmado. Quando puder, finalize por aqui: {{link_portal}}
Seu código: {{codigo_acesso}}

Obrigada!$msg$
FROM public.agencies a
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates t WHERE t.agency_id = a.id AND t.title = 'Lembrete de pagamento'
);
