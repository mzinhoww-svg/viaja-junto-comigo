/**
 * Código de acesso admin (VJT-011c) — ativa o plano Premium sem passar pelo
 * SQL Editor nem pelo checkout do Stripe. Substitui, no dia a dia, o runbook
 * manual do VJT-011b (`UPDATE entitlements SET plano='premium',
 * origem='manual' WHERE user_id=...`) para os casos operacionais: QA interno,
 * demo para cliente, e liberação do bônus Pro+/Vip+ pela consultoria.
 *
 * Módulo puro: sem I/O, sem acesso a Supabase — mesma convenção de
 * entitlements.ts/trip-math.ts. O código válido NUNCA vive aqui nem em
 * qualquer arquivo versionado: vem de `TRIP_ADMIN_CODE` (variável de
 * ambiente só do servidor, sem prefixo `VITE_`, para não ir no bundle do
 * client). A comparação e o bloqueio por tentativas ficam neste módulo para
 * serem testáveis; quem faz I/O é `trip-admin-code.functions.ts`.
 */

/**
 * Comprimento mínimo (já normalizado) de um código aceitável. Um código
 * curto demais é tratado como configuração inválida e ignorado — melhor o
 * recurso ficar desligado do que existir um código adivinhável por força
 * bruta liberando Premium vitalício.
 */
export const ADMIN_CODE_MIN_LENGTH = 12;

/** Tentativas erradas por usuário antes do bloqueio temporário. */
export const ADMIN_CODE_MAX_FAILS = 5;

/** Duração do bloqueio após estourar `ADMIN_CODE_MAX_FAILS`. */
export const ADMIN_CODE_BLOCK_MS = 15 * 60 * 1000;

/**
 * Normaliza o que o usuário digitou: maiúsculas e só alfanumérico. Assim
 * `vjt-aaaa bbbb-cccc`, `VJT-AAAA-BBBB-CCCC` e `VJTAAAABBBBCCCC` são o mesmo
 * código — hífen e espaço existem só para a leitura humana do código.
 */
export function normalizeAdminCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Lê `TRIP_ADMIN_CODE` (um código, ou vários separados por vírgula, para
 * permitir rotação sem janela de indisponibilidade) e devolve só os que
 * passam do comprimento mínimo. Lista vazia = recurso desligado.
 */
export function parseAdminCodes(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map(normalizeAdminCode)
    .filter((code) => code.length >= ADMIN_CODE_MIN_LENGTH);
}

export function adminCodeEnabled(raw: string | undefined | null): boolean {
  return parseAdminCodes(raw).length > 0;
}

/**
 * Comparação de tempo constante em relação ao conteúdo do código (o
 * comprimento continua observável, o que é irrelevante aqui). Evita que o
 * tempo de resposta vaze um prefixo correto caractere a caractere.
 */
function timingSafeEquals(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Confere o código digitado contra os configurados. Percorre a lista inteira
 * de propósito (sem `some`/short-circuit) para não vazar, pelo tempo de
 * resposta, qual posição da lista casou.
 */
export function matchesAdminCode(input: string, codes: string[]): boolean {
  const normalizado = normalizeAdminCode(input);
  if (normalizado.length < ADMIN_CODE_MIN_LENGTH) return false;
  return codes.reduce((acc, code) => timingSafeEquals(normalizado, code) || acc, false);
}

/** Estado de tentativas de um usuário. `bloqueadoAte` em epoch ms. */
export type AdminCodeAttempts = { falhas: number; bloqueadoAte: number | null };

export const ADMIN_CODE_ATTEMPTS_ZERO: AdminCodeAttempts = { falhas: 0, bloqueadoAte: null };

export function isAdminCodeBlocked(state: AdminCodeAttempts, nowMs: number): boolean {
  return state.bloqueadoAte !== null && state.bloqueadoAte > nowMs;
}

/**
 * Registra uma tentativa errada. Ao atingir `ADMIN_CODE_MAX_FAILS`, bloqueia
 * por `ADMIN_CODE_BLOCK_MS` e zera o contador — o próximo ciclo recomeça do
 * zero depois que o bloqueio expira.
 */
export function registerAdminCodeFailure(
  state: AdminCodeAttempts,
  nowMs: number,
): AdminCodeAttempts {
  if (isAdminCodeBlocked(state, nowMs)) return state;
  const falhas = state.falhas + 1;
  if (falhas >= ADMIN_CODE_MAX_FAILS) {
    return { falhas: 0, bloqueadoAte: nowMs + ADMIN_CODE_BLOCK_MS };
  }
  return { falhas, bloqueadoAte: null };
}

/** Minutos restantes de bloqueio, arredondados para cima (para a mensagem). */
export function adminCodeBlockMinutesLeft(state: AdminCodeAttempts, nowMs: number): number {
  if (!isAdminCodeBlocked(state, nowMs)) return 0;
  return Math.ceil((state.bloqueadoAte! - nowMs) / 60_000);
}

/**
 * E-mail da conta que o código de login da equipe abre (VJT-011d), lido de
 * `TRIP_ADMIN_EMAIL`. O código nunca autentica um e-mail digitado na tela:
 * ele só abre esta conta, configurada no ambiente. É a diferença entre uma
 * credencial compartilhada de uma conta específica e um backdoor capaz de
 * entrar em qualquer conta do produto.
 */
export function parseAdminEmail(raw: string | undefined | null): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
