
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin','client');
CREATE TYPE public.proposal_status_t AS ENUM ('draft','sent','accepted');
CREATE TYPE public.payment_method_t AS ENUM ('pix','card');
CREATE TYPE public.payment_status_t AS ENUM ('pending','processing','declined','paid');
CREATE TYPE public.tax_status_t AS ENUM ('pending','paid');
CREATE TYPE public.doc_kind_t AS ENUM ('pass','foto','renda','vinc','ds160','outro');
CREATE TYPE public.doc_status_t AS ENUM ('locked','pending','received','approved','rejected');
CREATE TYPE public.ds160_status_t AS ENUM ('draft','received','validated');
CREATE TYPE public.sched_service_t AS ENUM ('casv','entrevista','pf');
CREATE TYPE public.sched_status_t AS ENUM ('open','sent','confirmed');
CREATE TYPE public.product_key_t AS ENUM ('vistos','pass','rot','mil');
CREATE TYPE public.per_t AS ENUM ('person','group');
CREATE TYPE public.visto_plan_t AS ENUM ('start','pro','prem');
CREATE TYPE public.contract_status_t AS ENUM ('draft','sent','signed');
CREATE TYPE public.msg_from_t AS ENUM ('client','consultant');
CREATE TYPE public.journey_step_status_t AS ENUM ('done','active','locked');

-- ============================================================
-- AGENCIES
-- ============================================================
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agencies TO authenticated;
GRANT ALL ON public.agencies TO service_role;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'client',
  name TEXT,
  email TEXT,
  agency_id UUID REFERENCES public.agencies(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper: has_role (security definer, avoids recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT agency_id FROM public.profiles WHERE id = auth.uid(); $$;

-- Profiles policies
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- handle_new_user: create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE default_agency UUID;
BEGIN
  SELECT id INTO default_agency FROM public.agencies ORDER BY created_at LIMIT 1;
  INSERT INTO public.profiles (id, role, name, email, agency_id)
  VALUES (NEW.id, 'client', COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.email, default_agency)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- REQUESTS
-- ============================================================
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id),
  lead_name TEXT NOT NULL,
  lead_email TEXT NOT NULL,
  lead_phone TEXT,
  access_code TEXT NOT NULL,
  combo_pct INTEGER NOT NULL DEFAULT 10,
  proposal_status public.proposal_status_t NOT NULL DEFAULT 'draft',
  contract_signed BOOLEAN NOT NULL DEFAULT false,
  sign_name TEXT,
  signed_at TIMESTAMPTZ,
  payment_method public.payment_method_t,
  payment_status public.payment_status_t NOT NULL DEFAULT 'pending',
  tax_status public.tax_status_t NOT NULL DEFAULT 'pending',
  usd_rate NUMERIC(10,4),
  usd_as_of TIMESTAMPTZ,
  usd_source TEXT,
  sched_window_open BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, access_code)
);
CREATE INDEX requests_lead_email_idx ON public.requests (lower(lead_email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- is_request_member: admin da agência OR cliente cujo e-mail bate
CREATE OR REPLACE FUNCTION public.is_request_member(_request_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id
      AND (
        (public.has_role(auth.uid(),'admin') AND r.agency_id = public.current_agency_id())
        OR lower(r.lead_email) = lower(coalesce((auth.jwt() ->> 'email'),''))
      )
  );
$$;

CREATE POLICY requests_admin_all ON public.requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id());
CREATE POLICY requests_client_read ON public.requests
  FOR SELECT TO authenticated
  USING (lower(lead_email) = lower(coalesce((auth.jwt() ->> 'email'),'')));

-- ============================================================
-- TRAVELERS / REQUEST_GROUP
-- ============================================================
CREATE TABLE public.travelers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_lead BOOLEAN NOT NULL DEFAULT false,
  has_vistos BOOLEAN NOT NULL DEFAULT false,
  has_pass BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travelers TO authenticated;
GRANT ALL ON public.travelers TO service_role;
ALTER TABLE public.travelers ENABLE ROW LEVEL SECURITY;
CREATE POLICY travelers_member ON public.travelers
  FOR ALL TO authenticated
  USING (public.is_request_member(request_id))
  WITH CHECK (public.is_request_member(request_id));

CREATE TABLE public.request_group (
  request_id UUID PRIMARY KEY REFERENCES public.requests(id) ON DELETE CASCADE,
  has_rot BOOLEAN NOT NULL DEFAULT false,
  has_mil BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_group TO authenticated;
GRANT ALL ON public.request_group TO service_role;
ALTER TABLE public.request_group ENABLE ROW LEVEL SECURITY;
CREATE POLICY request_group_member ON public.request_group
  FOR ALL TO authenticated
  USING (public.is_request_member(request_id))
  WITH CHECK (public.is_request_member(request_id));

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traveler_id UUID NOT NULL REFERENCES public.travelers(id) ON DELETE CASCADE,
  kind public.doc_kind_t NOT NULL,
  name TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  status public.doc_status_t NOT NULL DEFAULT 'pending',
  file_url TEXT,
  reject_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_member ON public.documents
  FOR ALL TO authenticated
  USING (public.is_request_member((SELECT request_id FROM public.travelers WHERE id = traveler_id)))
  WITH CHECK (public.is_request_member((SELECT request_id FROM public.travelers WHERE id = traveler_id)));

-- Trigger: ao criar viajante, criar docs padrão
CREATE OR REPLACE FUNCTION public.create_traveler_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.documents (traveler_id, kind, name, status, required) VALUES
    (NEW.id, 'pass',  'Passaporte atual',                  'pending', true),
    (NEW.id, 'foto',  'Foto 5x5 digital',                  'pending', true),
    (NEW.id, 'renda', 'Comprovante de renda',              'pending', true),
    (NEW.id, 'vinc',  'Comprovante de vínculo',            'pending', true),
    (NEW.id, 'ds160', 'Confirmação DS-160 (geramos pra você)', 'locked', true);
  INSERT INTO public.ds160_submission (traveler_id, form, completion_pct, status)
    VALUES (NEW.id, '{}'::jsonb, 0, 'draft')
    ON CONFLICT (traveler_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- ============================================================
-- DS-160
-- ============================================================
CREATE TABLE public.ds160_submission (
  traveler_id UUID PRIMARY KEY REFERENCES public.travelers(id) ON DELETE CASCADE,
  form JSONB NOT NULL DEFAULT '{}'::jsonb,
  completion_pct INTEGER NOT NULL DEFAULT 0,
  status public.ds160_status_t NOT NULL DEFAULT 'draft',
  package JSONB,
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ds160_submission TO authenticated;
GRANT ALL ON public.ds160_submission TO service_role;
ALTER TABLE public.ds160_submission ENABLE ROW LEVEL SECURITY;
CREATE POLICY ds160_member ON public.ds160_submission
  FOR ALL TO authenticated
  USING (public.is_request_member((SELECT request_id FROM public.travelers WHERE id = traveler_id)))
  WITH CHECK (public.is_request_member((SELECT request_id FROM public.travelers WHERE id = traveler_id)));

-- Agora podemos criar o trigger (depende de ds160_submission)
CREATE TRIGGER trg_create_traveler_defaults
  AFTER INSERT ON public.travelers
  FOR EACH ROW EXECUTE FUNCTION public.create_traveler_defaults();

-- ============================================================
-- SCHEDULE
-- ============================================================
CREATE TABLE public.schedule_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traveler_id UUID NOT NULL REFERENCES public.travelers(id) ON DELETE CASCADE,
  service public.sched_service_t NOT NULL,
  wish TEXT,
  status public.sched_status_t NOT NULL DEFAULT 'open',
  confirmed_date DATE,
  confirmed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_intents TO authenticated;
GRANT ALL ON public.schedule_intents TO service_role;
ALTER TABLE public.schedule_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedule_intents_member ON public.schedule_intents
  FOR ALL TO authenticated
  USING (public.is_request_member((SELECT request_id FROM public.travelers WHERE id = traveler_id)))
  WITH CHECK (public.is_request_member((SELECT request_id FROM public.travelers WHERE id = traveler_id)));

CREATE TABLE public.schedule_window (
  agency_id UUID PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  released_quinzenas JSONB NOT NULL DEFAULT '[]'::jsonb,
  slots JSONB NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_window TO authenticated;
GRANT ALL ON public.schedule_window TO service_role;
ALTER TABLE public.schedule_window ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedule_window_admin ON public.schedule_window
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id());

-- ============================================================
-- CATALOG
-- ============================================================
CREATE TABLE public.products_catalog (
  key public.product_key_t PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT,
  price NUMERIC(10,2) NOT NULL,
  tagline TEXT,
  descr TEXT,
  per public.per_t NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  color TEXT,
  tint TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT ON public.products_catalog TO authenticated;
GRANT ALL ON public.products_catalog TO service_role;
ALTER TABLE public.products_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_catalog_read ON public.products_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY products_catalog_admin ON public.products_catalog
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.visto_plans (
  key public.visto_plan_t PRIMARY KEY,
  label TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  descr TEXT
);
GRANT SELECT ON public.visto_plans TO authenticated;
GRANT ALL ON public.visto_plans TO service_role;
ALTER TABLE public.visto_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY visto_plans_read ON public.visto_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY visto_plans_admin ON public.visto_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- CONTRACTS / MESSAGES / NOTIFICATIONS
-- ============================================================
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  client TEXT,
  product TEXT,
  template TEXT,
  status public.contract_status_t NOT NULL DEFAULT 'draft',
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contracts_member ON public.contracts FOR ALL TO authenticated
  USING (public.is_request_member(request_id)) WITH CHECK (public.is_request_member(request_id));

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  "from" public.msg_from_t NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_member ON public.messages FOR ALL TO authenticated
  USING (public.is_request_member(request_id)) WITH CHECK (public.is_request_member(request_id));

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_member ON public.notifications FOR ALL TO authenticated
  USING (public.is_request_member(request_id)) WITH CHECK (public.is_request_member(request_id));

-- ============================================================
-- MILHAS / ROTEIROS / ATENDIMENTOS / AUDIT
-- ============================================================
CREATE TABLE public.milhas_consult (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  status TEXT,
  saida TEXT, destino TEXT, cabine TEXT, programa TEXT, saldo TEXT, obs TEXT,
  plano TEXT, alertas JSONB DEFAULT '[]'::jsonb, anexos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milhas_consult TO authenticated;
GRANT ALL ON public.milhas_consult TO service_role;
ALTER TABLE public.milhas_consult ENABLE ROW LEVEL SECURITY;
CREATE POLICY milhas_member ON public.milhas_consult FOR ALL TO authenticated
  USING (public.is_request_member(request_id)) WITH CHECK (public.is_request_member(request_id));

CREATE TABLE public.roteiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  trip TEXT, version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'producao',
  nota TEXT, anexos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roteiros TO authenticated;
GRANT ALL ON public.roteiros TO service_role;
ALTER TABLE public.roteiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY roteiros_member ON public.roteiros FOR ALL TO authenticated
  USING (public.is_request_member(request_id)) WITH CHECK (public.is_request_member(request_id));

CREATE TABLE public.atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  who TEXT, date TIMESTAMPTZ, channel TEXT, origin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimentos TO authenticated;
GRANT ALL ON public.atendimentos TO service_role;
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY atendimentos_admin ON public.atendimentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id());

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor UUID, action TEXT NOT NULL, target TEXT, payload JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_admin_read ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- ACCESS CODE ATTEMPTS (rate-limit)
-- ============================================================
CREATE TABLE public.access_code_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX access_code_attempts_lookup ON public.access_code_attempts (lower(email), at DESC);
GRANT INSERT ON public.access_code_attempts TO anon, authenticated;
GRANT SELECT ON public.access_code_attempts TO authenticated;
GRANT ALL ON public.access_code_attempts TO service_role;
ALTER TABLE public.access_code_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ac_attempts_anyone_insert ON public.access_code_attempts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY ac_attempts_admin_read ON public.access_code_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- compute_journey_steps: verdade derivada das 7 etapas
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_journey_steps(_request_id UUID)
RETURNS TABLE(idx INT, key TEXT, label TEXT, status public.journey_step_status_t)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.requests%ROWTYPE;
  docs_ok BOOLEAN := false;
  intent_ok BOOLEAN := false;
  flags BOOLEAN[7];
  i INT;
  s public.journey_step_status_t;
  active_set BOOLEAN := false;
  keys TEXT[]   := ARRAY['proposta','contrato','pagamento','documentos','taxas','agenda','conclusao'];
  labels TEXT[] := ARRAY['Proposta','Contrato','Pagamento','Documentos','Taxas','Agendamentos','Conclusão'];
BEGIN
  SELECT * INTO r FROM public.requests WHERE id = _request_id;
  IF r.id IS NULL THEN RETURN; END IF;

  -- documentos (exceto ds160) todos em received/approved
  SELECT NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.travelers t ON t.id = d.traveler_id
    WHERE t.request_id = _request_id AND d.kind <> 'ds160'
      AND d.status NOT IN ('received','approved')
  ) AND EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.travelers t ON t.id = d.traveler_id
    WHERE t.request_id = _request_id AND d.kind <> 'ds160'
  ) INTO docs_ok;

  SELECT EXISTS (
    SELECT 1 FROM public.schedule_intents si
    JOIN public.travelers t ON t.id = si.traveler_id
    WHERE t.request_id = _request_id AND si.status = 'confirmed'
  ) INTO intent_ok;

  flags[1] := r.proposal_status = 'accepted';
  flags[2] := r.contract_signed = true;
  flags[3] := r.payment_status = 'paid';
  flags[4] := docs_ok;
  flags[5] := r.tax_status = 'paid';
  flags[6] := intent_ok;
  flags[7] := false;

  FOR i IN 1..7 LOOP
    IF flags[i] THEN
      s := 'done';
    ELSIF NOT active_set THEN
      s := 'active'; active_set := true;
    ELSE
      s := 'locked';
    END IF;
    idx := i; key := keys[i]; label := labels[i]; status := s;
    RETURN NEXT;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION public.compute_journey_steps(UUID) TO authenticated;

-- ============================================================
-- SEEDS
-- ============================================================
INSERT INTO public.agencies (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Viajaly');

INSERT INTO public.products_catalog (key, name, tier, price, tagline, per, active, color, tint, sort_order) VALUES
  ('vistos','Viajaly Vistos','Pro+',1890,'DS-160 + entrevista','person',true,'#FF5A5F','#FFE9EA',1),
  ('pass','Viajaly Passaporte',NULL,390,'Emissão sem fila','person',true,'#2DB7C9','#D9F2F6',2),
  ('rot','Viajaly Roteiros',NULL,1200,'Itinerário sob medida','group',true,'#E8A33D','#FBEFD9',3),
  ('mil','Viajaly Milhas',NULL,690,'Consultoria de milhas','group',true,'#1F8A5B','#DEF1E7',4);

INSERT INTO public.visto_plans (key, label, price, descr) VALUES
  ('start','Start+',990,'DS-160 + orientações essenciais'),
  ('pro','Pro+',1890,'DS-160 + simulação de entrevista'),
  ('prem','Premium+',2790,'Pro+ com acompanhamento dedicado');

-- ============================================================
-- REALTIME publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_intents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ds160_submission;
