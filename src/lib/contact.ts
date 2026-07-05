/**
 * Fonte única de verdade para canais de contato da Viajaly.
 * Qualquer link wa.me / WhatsApp deve derivar destas constantes.
 * Atualize SOMENTE aqui — o número é injetado nas páginas .html (token
 * `__WHATSAPP_NUMBER__`) e importado pelos componentes React via `@/lib/whatsapp`.
 */
export const WHATSAPP_NUMBER = "5565996076018";

export const WHATSAPP_DEFAULT_MESSAGE =
  "Olá! Vim pelo site da Viajaly e quero falar sobre minha viagem.";
