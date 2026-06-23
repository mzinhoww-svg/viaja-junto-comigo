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
  const phone = (e164 ?? "").replace(/\D/g, "");
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
}
