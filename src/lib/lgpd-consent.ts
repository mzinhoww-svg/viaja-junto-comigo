/**
 * Consentimento LGPD (VJT-017 + VJT-017b, VIAJALY-TRIP.md Seção 7). O produto
 * Trip não tem formulário de signup próprio — a conta nasce compartilhada com
 * o app de visto (login OTP do portal). `LgpdConsentGate` bloqueia o acesso a
 * `/trip/*` até o aceite explícito da versão VIGENTE do texto, registrado em
 * `user_lgpd_consents` (log append-only, uma linha por versão aceita).
 *
 * Regra de manutenção: **toda mudança em `LGPD_CONSENT_TEXT` ou em
 * `LGPD_SUBPROCESSADORES` exige bumpar `LGPD_CONSENT_VERSION`**. A versão é o
 * único mecanismo que re-apresenta o aceite para quem já consentiu; sem o
 * bump, o texto novo só é visto por usuários novos — exatamente a população
 * que menos precisa ser informada de um subprocessador novo.
 */

/**
 * v1 → v2 (VJT-017b, issue #65): o v1 era genérico ("tratamento dos meus dados
 * pessoais conforme a Política de Privacidade") e não cobria a categoria de
 * tratamento introduzida pelo assistente de IA — envio do conteúdo da viagem
 * para provedores terceiros, dois deles fora do Brasil. Quem aceitou v1 é
 * re-apresentado ao gate; a linha do v1 é preservada no log.
 */
export const LGPD_CONSENT_VERSION = "v2";

export type LgpdSubprocessador = {
  /** Nome do terceiro, como aparece no consentimento e na Política. */
  nome: string;
  /** O que ele faz com o dado — não o produto que ele vende. */
  papel: string;
  /** País de processamento; o que dispara o aviso de transferência internacional. */
  pais: string;
  /** `true` quando o processamento acontece fora do Brasil (LGPD Cap. V). */
  transferenciaInternacional: boolean;
};

/**
 * Subprocessadores efetivamente usados pelo produto — fonte única para o
 * checkbox de consentimento e para a seção "Compartilhamento" de
 * `/privacidade`, para que os dois não divirjam.
 *
 * OpenRouter e DeepSeek entram com o assistente de IA (VJT-014 + PR #63): o
 * contexto da trip (destino, cidade, data, número de pessoas, progresso) e o
 * texto livre digitado no chat saem da Supabase e são processados por eles.
 * Essa categoria — inferência de IA sobre dados da viagem — não existia em
 * nenhum texto até o VJT-017b, e não cabe em "hospedagem" nem em "mensageria".
 */
export const LGPD_SUBPROCESSADORES: readonly LgpdSubprocessador[] = [
  {
    nome: "Supabase",
    papel: "hospedagem do banco de dados, autenticação e execução das funções do produto",
    pais: "Estados Unidos",
    transferenciaInternacional: true,
  },
  {
    nome: "Stripe",
    papel: "processamento do pagamento do plano Premium",
    pais: "Estados Unidos",
    transferenciaInternacional: true,
  },
  {
    nome: "OpenRouter",
    papel: "roteamento das mensagens do assistente de IA até o modelo que responde",
    pais: "Estados Unidos",
    transferenciaInternacional: true,
  },
  {
    nome: "DeepSeek",
    papel: "inferência de inteligência artificial sobre os dados da sua viagem",
    pais: "China",
    transferenciaInternacional: true,
  },
] as const;

/**
 * Texto do checkbox. Nomeia os subprocessadores de IA e a transferência
 * internacional no próprio ponto de aceite (não só na Política linkada),
 * porque é essa a categoria de tratamento que o usuário não consegue deduzir
 * do resto do produto.
 */
export const LGPD_CONSENT_TEXT =
  "Li e concordo com o tratamento dos meus dados pessoais pela Viajaly conforme a Política de Privacidade, " +
  "para o funcionamento da Viajaly Trip. Isso inclui o envio dos dados da minha viagem (destino, datas, " +
  "número de viajantes, progresso e o que eu escrever no assistente) para OpenRouter (Estados Unidos) e " +
  "DeepSeek (China), que os processam por inteligência artificial para gerar as respostas do assistente — " +
  "o que caracteriza transferência internacional de dados pessoais.";
