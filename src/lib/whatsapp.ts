export function buildHandoffMessage(args: { name: string; link: string; code: string }) {
  const first = (args.name || "").trim().split(/\s+/)[0] || "Olá";
  return (
`Oi, ${first}! Aqui é da Viajaly ✨

Preparamos sua proposta personalizada. Para acessar é só seguir 2 passos:

1) Abra: ${args.link}
2) Use seu e-mail + o código: ${args.code}

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
