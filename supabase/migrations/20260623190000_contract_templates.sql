-- =========================================================
-- FATIA — Templates de contrato editáveis (Build Spec §12: templates por produto)
-- Modelo seguro: o template tem placeholders; renderContract usa o template ativo
-- e, na ausência dele, cai no texto padrão hardcoded (assinatura nunca quebra).
-- =========================================================

CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'default',   -- 'default' ou uma product_key no futuro
  title text NOT NULL DEFAULT 'Contrato padrão',
  body_html text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS contract_templates_scope_key ON public.contract_templates(scope);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado (o cliente precisa renderizar o contrato no portal).
DROP POLICY IF EXISTS contract_templates_read ON public.contract_templates;
CREATE POLICY contract_templates_read ON public.contract_templates
  FOR SELECT TO authenticated USING (true);

-- Escrita: somente admin.
DROP POLICY IF EXISTS contract_templates_admin_write ON public.contract_templates;
CREATE POLICY contract_templates_admin_write ON public.contract_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed do template 'default' (mesma estrutura do contrato atual, com placeholders).
-- Placeholders preenchidos por renderContract: {{AGENCY}} {{CLIENT}} {{TRAVELERS}} {{ITEMS}} {{TOTAL}} {{DATE}}
INSERT INTO public.contract_templates(scope, title, body_html)
VALUES ('default', 'Contrato padrão (consultoria)',
'<h2>Contrato de Prestação de Serviços de Consultoria de Viagem</h2>
<p><b>CONTRATADA:</b> {{AGENCY}}<br/><b>CONTRATANTE:</b> {{CLIENT}}</p>
<h3>1. Objeto</h3>
<p>A CONTRATADA prestará serviços de consultoria especializada para obtenção de visto americano e gestão da jornada de viagem, incluindo orientação sobre preenchimento do formulário DS-160, agendamento de entrevista no consulado, análise documental e suporte ao CONTRATANTE.</p>
<h3>2. Viajantes</h3>
<ul>{{TRAVELERS}}</ul>
<h3>3. Itens contratados</h3>
<ul>{{ITEMS}}</ul>
<p><b>Valor total: {{TOTAL}}</b> — referente à consultoria. Taxas governamentais (MRV/visto, passaporte, Polícia Federal) são pagas à parte pelo CONTRATANTE.</p>
<h3>4. Prazo e obrigações</h3>
<p>O serviço inicia-se após a confirmação do pagamento. A CONTRATADA compromete-se a entregar o suporte com agilidade e a manter o CONTRATANTE informado de cada etapa pelo portal.</p>
<h3>5. Cancelamento</h3>
<p>O CONTRATANTE poderá solicitar cancelamento em até 7 dias da assinatura (CDC art. 49). Após esse prazo, valores correspondentes a serviços já executados (DS-160 preenchido, agendamento, taxa consular) não são reembolsáveis.</p>
<h3>6. LGPD</h3>
<p>O CONTRATANTE autoriza o tratamento dos seus dados pessoais e dos viajantes para a finalidade estrita deste contrato, em conformidade com a Lei nº 13.709/2018.</p>
<h3>7. Foro</h3>
<p>Fica eleito o foro do domicílio do CONTRATANTE para dirimir eventuais dúvidas.</p>
<p style="margin-top:24px"><b>{{DATE}}</b> — Aceite digital realizado pelo CONTRATANTE no portal Viajaly.</p>')
ON CONFLICT (scope) DO NOTHING;
