const VIAJALY_WA = "5565996076018";

/**
 * WhatsApp helpers — usa wa.me (sem custo de API oficial).
 * Sempre direciona para o número da Viajaly.
 */

export function normalizeE164BR(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return VIAJALY_WA;
  // já vem com DDI (>=12 dígitos) → mantém só dígitos
  if (digits.length >= 12) return digits;
  // assume BR sem DDI (10 ou 11 dígitos com DDD) → prefixa 55
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function waLink(phoneE164: string | null | undefined, message: string): string {
  const phone = normalizeE164BR(phoneE164);
  const text = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${text}`;
}

/**
 * Constrói o link personalizado de acesso do cliente.
 * Inclui o código como query param para auto-preenchimento no portal.
 */
export function personalizedAccessLink(code: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/portal/login?code=${encodeURIComponent(code)}`;
}

export function buildHandoffMessage(args: { name: string; link: string; code: string }) {
  const first = (args.name || "").trim().split(/\s+/)[0] || "Olá";
  return (
`Oi, ${first}! Aqui é da Viajaly ✨

Preparamos sua proposta personalizada. Para acessar é só clicar no link abaixo — o código já vai preenchido:

🔗 ${args.link}

Caso precise digitar manualmente, seu código é: ${args.code}

Qualquer dúvida, é só responder por aqui. Até já! 💛`
  );
}

export function openWhatsApp(e164: string | null | undefined, text: string) {
  if (typeof window === "undefined") return;
  window.open(waLink(e164, text), "_blank", "noopener");
}

// --- Mensagens prontas para avisos acionáveis ---

export const waTemplates = {
  proposalAccepted: (name: string) => {
    const first = (name || "").trim().split(/\s+/)[0] || "Olá";
    return `Oi, ${first}! Recebemos seu aceite da proposta na Viajaly. Vamos seguir com os próximos passos — qualquer dúvida é só responder por aqui. 💛`;
  },
  documentApproved: (name: string, docLabel: string) => {
    const first = (name || "").trim().split(/\s+/)[0] || "Olá";
    return `Oi, ${first}! Seu documento "${docLabel}" foi aprovado ✅. Já está tudo certo dessa parte.`;
  },
  documentRejected: (name: string, docLabel: string, reason?: string) => {
    const first = (name || "").trim().split(/\s+/)[0] || "Olá";
    const r = reason ? `\nMotivo: ${reason}` : "";
    return `Oi, ${first}! Precisamos que você reenvie o documento "${docLabel}".${r}\nAcesse o portal para subir a nova versão. 💛`;
  },
  scheduleConfirmed: (name: string, whenISO: string) => {
    const first = (name || "").trim().split(/\s+/)[0] || "Olá";
    const when = new Date(whenISO).toLocaleString("pt-BR");
    return `Oi, ${first}! Seu agendamento ficou confirmado para ${when}. Anota aí e qualquer coisa me avisa. 💛`;
  },
  paymentConfirmed: (name: string) => {
    const first = (name || "").trim().split(/\s+/)[0] || "Olá";
    return `Oi, ${first}! Recebemos seu pagamento ✅. Já liberamos as próximas etapas da sua jornada no portal. 💛`;
  },
};
