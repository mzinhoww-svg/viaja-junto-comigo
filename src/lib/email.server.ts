// Server-only: envio de e-mail transacional via gateway do conector Brevo.
// Importar APENAS de outros arquivos *.server.ts ou dentro de handlers
// (server functions / server routes). Nunca importar do bundle do cliente.
//
// Requer:
//   - LOVABLE_API_KEY  (injetada pela plataforma)
//   - BREVO_API_KEY    (connection key do conector Brevo)
//   - BREVO_SENDER     (ex.: "Viajaly <contato@viajaly.app>") — sem isso vira no-op
//
// Mantém o mesmo contrato da antiga edge function `send-email` para não quebrar
// chamadores: { template, to, vars, subject? } → { sent, reason?, messageId? }.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo/smtp/email";

export type TemplateKey =
  | "access_code"
  | "proposal_sent"
  | "payment_confirmed"
  | "document_rejected"
  | "schedule_confirmed";

export type EmailVars = Record<string, string | number | undefined>;

export type SendEmailInput = {
  template: TemplateKey;
  to: string | { email: string; name?: string };
  vars?: EmailVars;
  subject?: string;
};

export type SendEmailResult =
  | { sent: true; messageId: string | null }
  | { sent: false; reason: string; status?: number };

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(title: string, inner: string): string {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
  <body style="font-family:Arial,sans-serif;background:#fff;color:#1a1a1a;padding:24px">
    <div style="max-width:560px;margin:0 auto">
      <h1 style="color:#0B234F;font-size:20px;margin:0 0 12px">${esc(title)}</h1>
      <div style="font-size:15px;line-height:1.5">${inner}</div>
      <p style="margin-top:24px;font-size:12px;color:#888">Viajaly — consultoria de viagem.</p>
    </div>
  </body></html>`;
}

const TEMPLATES: Record<TemplateKey, (v: EmailVars) => { subject: string; html: string }> = {
  access_code: (v) => ({
    subject: "Seu código de acesso — Viajaly",
    html: shell("Seu código de acesso", `
      <p>Olá${v.name ? `, <b>${esc(v.name)}</b>` : ""}!</p>
      <p>Use o código abaixo para entrar no portal:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#0B234F">${esc(v.code)}</p>
      <p>Se você não solicitou este código, ignore esta mensagem.</p>`),
  }),
  proposal_sent: (v) => ({
    subject: "Sua proposta personalizada chegou — Viajaly",
    html: shell("Sua proposta está pronta", `
      <p>Oi${v.name ? `, <b>${esc(v.name)}</b>` : ""}! Preparamos uma proposta para você.</p>
      <p><a href="${esc(v.link)}" style="background:#FF6F61;color:#fff;padding:12px 20px;border-radius:24px;text-decoration:none;display:inline-block;font-weight:bold">Abrir minha proposta</a></p>
      <p>Código de acesso: <b>${esc(v.code)}</b></p>`),
  }),
  payment_confirmed: (v) => ({
    subject: "Pagamento confirmado — Viajaly",
    html: shell("Pagamento confirmado ✅", `
      <p>Oi${v.name ? `, <b>${esc(v.name)}</b>` : ""}! Recebemos seu pagamento.</p>
      <p>Já liberamos as próximas etapas no portal. Bora seguir? 💛</p>
      <p><a href="${esc(v.link ?? "https://viajaly.app/portal")}" style="color:#0B234F">Abrir portal</a></p>`),
  }),
  document_rejected: (v) => ({
    subject: "Precisamos reenviar um documento — Viajaly",
    html: shell("Documento precisa de ajuste", `
      <p>Oi${v.name ? `, <b>${esc(v.name)}</b>` : ""}! Revisamos seu documento <b>${esc(v.document)}</b> e ele precisa ser reenviado.</p>
      ${v.reason ? `<p><b>Motivo:</b> ${esc(v.reason)}</p>` : ""}
      <p><a href="${esc(v.link ?? "https://viajaly.app/portal/documentos")}" style="color:#0B234F">Abrir portal e reenviar</a></p>`),
  }),
  schedule_confirmed: (v) => ({
    subject: "Agendamento confirmado — Viajaly",
    html: shell("Seu agendamento está confirmado", `
      <p>Oi${v.name ? `, <b>${esc(v.name)}</b>` : ""}!</p>
      <p>Seu agendamento ficou marcado para <b>${esc(v.when)}</b>.</p>
      ${v.location ? `<p><b>Local:</b> ${esc(v.location)}</p>` : ""}`),
  }),
};

function parseSender(s: string): { email: string; name?: string } {
  const m = s.match(/^\s*(.+?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1], email: m[2] };
  return { email: s.trim() };
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { template, to, vars = {}, subject: subjectOverride } = input;

  if (!template || !TEMPLATES[template]) {
    return { sent: false, reason: "invalid_template" };
  }
  if (!to) {
    return { sent: false, reason: "missing_to" };
  }

  const lovableKey = process.env.LOVABLE_API_KEY ?? "";
  const brevoKey = process.env.BREVO_API_KEY ?? "";
  const sender = process.env.BREVO_SENDER ?? "";

  if (!lovableKey || !brevoKey || !sender) {
    console.log("[email] no-op", {
      template,
      hasLovable: !!lovableKey,
      hasBrevo: !!brevoKey,
      hasSender: !!sender,
    });
    return { sent: false, reason: "email_disabled" };
  }

  const tpl = TEMPLATES[template](vars);
  const toList = typeof to === "string" ? [{ email: to }] : [to];
  const senderObj = parseSender(sender);

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": brevoKey,
      },
      body: JSON.stringify({
        sender: senderObj,
        to: toList,
        subject: subjectOverride ?? tpl.subject,
        htmlContent: tpl.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[email] brevo gateway error", res.status, text);
      return { sent: false, reason: "brevo_error", status: res.status };
    }
    const out = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { sent: true, messageId: out?.messageId ?? null };
  } catch (e) {
    console.error("[email] fetch error", e);
    return { sent: false, reason: "fetch_error" };
  }
}
