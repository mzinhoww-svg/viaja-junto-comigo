/**
 * Assistente IA do Viajaly Trip (VJT-014, VIAJALY-TRIP.md Seção 7).
 * Módulo puro: sem I/O, sem acesso a Supabase/provider de IA — mesma
 * convenção de trip-math.ts/entitlements.ts/trip-visa.ts. Reaproveitado tanto
 * pelo client quanto pela Edge Function `supabase/functions/ai-chat` (import
 * relativo, runtime Deno consegue importar este arquivo sem alteração).
 */

/**
 * Modelo econômico (Seção 3). Servido via OpenRouter, que usa o formato de
 * API do OpenAI — o identificador precisa vir no formato `vendor/modelo`.
 * DeepSeek foi escolhido por custo bem abaixo da classe Haiku.
 * A Edge Function permite sobrescrever isto pelo secret `AI_MODEL`, então dá
 * para testar outro modelo sem novo deploy.
 */
export const AI_MODEL = "deepseek/deepseek-chat";

/** Teto de tokens de saída — respostas de assistente de viagem são curtas. */
export const AI_MAX_TOKENS = 1024;

/** Quantas mensagens anteriores da conversa entram como contexto (histórico curto, custo baixo). */
export const AI_HISTORY_LIMIT = 20;

/** Tamanho máximo de uma mensagem do usuário (evita prompts absurdamente longos). */
export const AI_MAX_MESSAGE_LENGTH = 1000;

export type TripAiContext = {
  nome: string;
  destinoPais: string;
  destinoCidade: string | null;
  modo: "sonho" | "planejando" | "concluida";
  dataViagemFormatada: string | null;
  mesesRestantes: number | null;
  numPessoas: number;
};

export function isMessageValid(message: string): boolean {
  const trimmed = message.trim();
  return trimmed.length > 0 && trimmed.length <= AI_MAX_MESSAGE_LENGTH;
}

/**
 * Termos que sinalizam dúvida sobre visto — gatilho para o redirecionamento
 * determinístico ao WhatsApp (Seção 7: "redireciona visto com UTM"), sem
 * gastar uma chamada ao modelo. Lista pequena e específica de propósito
 * (não tenta cobrir "fora de escopo" em geral — isso fica a cargo do prompt
 * de sistema, ver `buildSystemPrompt`).
 */
const VISA_KEYWORDS = [
  "visto",
  "vistos",
  "visa",
  "embaixada",
  "consulado",
  "consular",
  "entrevista de visto",
  "ds-160",
  "ds160",
  "eta",
  "esta ",
] as const;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isVisaQuestion(message: string): boolean {
  const normalizado = normalizar(message);
  return VISA_KEYWORDS.some((termo) => normalizado.includes(normalizar(termo)));
}

function formatarModo(modo: TripAiContext["modo"]): string {
  if (modo === "sonho") return "ainda sem data definida (modo sonho)";
  if (modo === "concluida") return "já realizada (modo concluída)";
  return "em planejamento";
}

/**
 * Bloco de contexto real da trip injetado no prompt (Seção 7: "contexto da
 * trip injetado"; aceite: "resposta usa dados reais da trip"). Só texto
 * descritivo — nenhuma fórmula de trip-math.ts é reimplementada aqui.
 */
export function buildTripContextBlock(context: TripAiContext): string {
  const linhas = [
    `Nome da viagem: ${context.nome}`,
    `Destino: ${context.destinoCidade ? `${context.destinoCidade}, ` : ""}${context.destinoPais}`,
    `Status: ${formatarModo(context.modo)}`,
  ];
  if (context.dataViagemFormatada) {
    linhas.push(`Data da viagem: ${context.dataViagemFormatada}`);
  }
  if (context.mesesRestantes != null) {
    linhas.push(`Meses restantes até a viagem: ${context.mesesRestantes}`);
  }
  linhas.push(`Número de pessoas na viagem: ${context.numPessoas}`);
  return linhas.join("\n");
}

/**
 * Prompt de sistema — escopo de conversa fechado (Seção 7: "recusa educada
 * fora do tema de planejamento de viagem"). A recusa fina depende do modelo
 * seguir esta instrução (não há forma determinística de cobrir "fora de
 * escopo" em geral, ao contrário da detecção de visto acima); QA manual
 * cobre esse comportamento.
 */
export function buildSystemPrompt(context: TripAiContext): string {
  return `Você é o assistente de planejamento de viagens do Viajaly Trip, dedicado exclusivamente à viagem abaixo.

${buildTripContextBlock(context)}

Regras obrigatórias:
- Responda SOMENTE perguntas sobre o planejamento desta viagem: roteiro, checklist, orçamento, dicas de destino, clima, cultura local, o que levar na mala, etc.
- Se a pergunta não tiver relação com planejamento de viagem, recuse educadamente em uma frase e sugira que a pessoa volte a perguntar sobre a viagem. Nunca responda perguntas fora desse escopo, mesmo que pareçam inofensivas.
- Se a pergunta for sobre visto, documentação consular ou entrevista de visto, não tente responder no lugar de um especialista: oriente a pessoa a falar com a consultoria da Viajaly pelo WhatsApp.
- Respostas curtas e diretas, adequadas para leitura no celular (parágrafos curtos, sem markdown pesado).
- Responda sempre em português do Brasil.`;
}
