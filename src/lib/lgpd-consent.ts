/**
 * Consentimento LGPD (VJT-017, VIAJALY-TRIP.md Seção 7). O produto Trip não
 * tem formulário de signup próprio — a conta nasce compartilhada com o app
 * de visto (login OTP do portal). `LgpdConsentGate` bloqueia o primeiro
 * acesso a `/trip/*` até o aceite explícito, que é registrado uma vez por
 * usuário em `user_lgpd_consents`.
 */
export const LGPD_CONSENT_VERSION = "v1";

export const LGPD_CONSENT_TEXT =
  "Li e concordo com o tratamento dos meus dados pessoais pela Viajaly conforme a Política de Privacidade, para o funcionamento da Viajaly Trip.";
