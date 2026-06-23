import { formatBRL } from "./money";

export type ContractItem = { label: string; qty: number; unit_price_cents: number; discount_cents: number };
export type ContractCtx = {
  agencyName: string;
  clientName: string;
  clientEmail: string;
  travelers: { name: string; relation: string | null }[];
  items: ContractItem[];
  totalCents: number;
  todayISO: string;
};

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function renderContract(c: ContractCtx, templateHtml?: string | null): string {
  const today = new Date(c.todayISO).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const itemsHtml = c.items
    .map(
      (it) => `<li><b>${esc(it.label)}</b> — ${it.qty}× ${formatBRL(it.unit_price_cents)}${
        it.discount_cents > 0 ? ` (desc. ${formatBRL(it.discount_cents)})` : ""
      }</li>`,
    )
    .join("");
  const travHtml = c.travelers
    .map((t) => `<li>${esc(t.name)}${t.relation ? ` <span class="muted">(${esc(t.relation)})</span>` : ""}</li>`)
    .join("");

  // Template editável (admin): preenche placeholders. Qualquer ausência cai no padrão abaixo.
  if (templateHtml && templateHtml.trim()) {
    return templateHtml
      .split("{{AGENCY}}").join(esc(c.agencyName))
      .split("{{CLIENT}}").join(`${esc(c.clientName)} — ${esc(c.clientEmail)}`)
      .split("{{TRAVELERS}}").join(travHtml || "<li>Titular</li>")
      .split("{{ITEMS}}").join(itemsHtml)
      .split("{{TOTAL}}").join(formatBRL(c.totalCents))
      .split("{{DATE}}").join(today);
  }

  return `
<h2>Contrato de Prestação de Serviços de Consultoria de Viagem</h2>
<p><b>CONTRATADA:</b> ${esc(c.agencyName)}<br/>
<b>CONTRATANTE:</b> ${esc(c.clientName)} — ${esc(c.clientEmail)}</p>

<h3>1. Objeto</h3>
<p>A CONTRATADA prestará serviços de consultoria especializada para obtenção de visto americano e
gestão da jornada de viagem, incluindo orientação sobre preenchimento do formulário DS-160,
agendamento de entrevista no consulado, análise documental e suporte ao CONTRATANTE.</p>

<h3>2. Viajantes</h3>
<ul>${travHtml || "<li>Titular</li>"}</ul>

<h3>3. Itens contratados</h3>
<ul>${itemsHtml}</ul>
<p><b>Valor total: ${formatBRL(c.totalCents)}</b> — a ser pago via Pix em parcela única.</p>

<h3>4. Prazo e obrigações</h3>
<p>O serviço inicia-se após a confirmação do pagamento. A CONTRATADA compromete-se a entregar o
suporte com agilidade e a manter o CONTRATANTE informado de cada etapa pelo portal.</p>

<h3>5. Cancelamento</h3>
<p>O CONTRATANTE poderá solicitar cancelamento em até 7 dias da assinatura (CDC art. 49). Após esse
prazo, valores correspondentes a serviços já executados (DS-160 preenchido, agendamento, taxa
consular) não são reembolsáveis.</p>

<h3>6. LGPD</h3>
<p>O CONTRATANTE autoriza o tratamento dos seus dados pessoais e dos viajantes para a finalidade
estrita deste contrato, em conformidade com a Lei nº 13.709/2018.</p>

<h3>7. Foro</h3>
<p>Fica eleito o foro do domicílio do CONTRATANTE para dirimir eventuais dúvidas.</p>

<p style="margin-top:24px"><b>${today}</b> — Aceite digital realizado pelo CONTRATANTE no portal Viajaly.</p>
  `.trim();
}
