// supabase/functions/send-email/index.ts
//
// E-mail transacional via Brevo (https://developers.brevo.com/reference/sendtransacemail).
//
// PARA ATIVAR, configurar 3 secrets em Project Settings → Secrets:
//   - BREVO_API_KEY   → chave da API do Brevo (xkeysib-…)
//   - BREVO_SENDER    → e-mail do remetente verificado (ex.: "Viajaly <contato@viajaly.app>")
//   - EMAIL_ENABLED   → "true" para liberar envios; qualquer outro valor = no-op
//
// Enquanto qualquer um deles estiver vazio/desligado a função retorna {sent:false, reason:'email_disabled'}
// SEM quebrar nenhum fluxo. Os avisos seguem por wa.me + notificações internas.

// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type TemplateKey =
  | "access_code"
  | "proposal_sent"
  | "payment_confirmed"
  | "document_rejected"
  | "schedule_confirmed";

type Vars = Record<string, string | number | undefined>;

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

const TEMPLATES: Record<TemplateKey, (v: Vars) => { subject: string; html: string }> = {
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const template = body?.template as TemplateKey | undefined;
  const to = body?.to as string | { email: string; name?: string } | undefined;
  const vars = (body?.vars ?? {}) as Vars;
  const subjectOverride = body?.subject as string | undefined;

  if (!template || !TEMPLATES[template]) {
    return json({ sent: false, reason: "invalid_template" }, 200);
  }
  if (!to) {
    return json({ sent: false, reason: "missing_to" }, 200);
  }

  const apiKey = Deno.env.get("BREVO_API_KEY") ?? "";
  const sender = Deno.env.get("BREVO_SENDER") ?? "";
  const enabled = (Deno.env.get("EMAIL_ENABLED") ?? "").toLowerCase() === "true";

  if (!enabled || !apiKey || !sender) {
    console.log("[send-email] no-op", { template, enabled, hasKey: !!apiKey, hasSender: !!sender });
    return json({ sent: false, reason: "email_disabled" }, 200);
  }

  const tpl = TEMPLATES[template](vars);
  const toList = typeof to === "string" ? [{ email: to }] : [to];
  const senderObj = parseSender(sender);

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      "accept": "application/json",
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
    console.error("[send-email] brevo error", res.status, text);
    return json({ sent: false, reason: "brevo_error", status: res.status }, 200);
  }
  const out = await res.json().catch(() => ({}));
  return json({ sent: true, messageId: out?.messageId ?? null }, 200);
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function parseSender(s: string): { email: string; name?: string } {
  const m = s.match(/^\s*(.+?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1], email: m[2] };
  return { email: s.trim() };
}
