import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activateManualPremiumEntitlement } from "@/lib/premium-entitlement.server";
import {
  ADMIN_CODE_ATTEMPTS_ZERO,
  adminCodeBlockMinutesLeft,
  isAdminCodeBlocked,
  matchesAdminCode,
  parseAdminCodes,
  registerAdminCodeFailure,
  type AdminCodeAttempts,
} from "@/lib/trip-admin-code";

export type RedeemAdminCodeResult =
  { ok: true; already: boolean } | { ok: false; error: string; blocked?: boolean };

/**
 * Tentativas erradas por usuário. Mora na memória do processo: em serverless
 * cada instância tem a sua, então isto é atrito contra força bruta ingênua,
 * não uma garantia distribuída. O código em si é o controle forte (128 bits
 * de entropia na geração recomendada); se o volume de tentativas virar
 * problema real, o passo seguinte é uma tabela no Postgres — não mais estado
 * em memória.
 */
const attempts = new Map<string, AdminCodeAttempts>();

/**
 * Cliente service role só para a auditoria: `audit_log` não tem policy de
 * INSERT para o usuário autenticado nesta trilha, e a ativação em si já roda
 * com service role dentro de `activateManualPremiumEntitlement`.
 */
function getServiceClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Registra o resgate em `audit_log` (mesma tabela usada pelo console). É
 * best-effort de propósito: o Premium já foi ativado quando chegamos aqui, e
 * derrubar a resposta por falha de log deixaria o usuário achando que o
 * código não funcionou quando funcionou.
 */
async function logRedeem(userId: string, already: boolean): Promise<void> {
  try {
    await getServiceClient()
      .from("audit_log")
      .insert({
        actor: userId,
        action: "trip_admin_code_redeemed",
        target: userId,
        payload: { origem: "manual", already },
      });
  } catch (error) {
    console.error("[trip-admin-code] falha ao gravar audit_log", error);
  }
}

/**
 * Resgata o código de acesso admin (VJT-011c) e ativa o Premium do usuário
 * autenticado. O código válido vem de `TRIP_ADMIN_CODE` (env só do servidor)
 * e nunca é devolvido ao client — nem em mensagem de erro, nem em log.
 *
 * Procedimento operacional (incluindo o que este caminho não cobre e cai no
 * SQL): `docs/runbook-ativacao-manual-entitlements.md`.
 *
 * "Código inválido" e "recurso desligado neste ambiente" são mensagens
 * distintas: os dois casos só chegam a quem já está autenticado, e separá-los
 * evita o suporte caçar um código errado quando o que falta é a variável de
 * ambiente. Nenhuma das duas diz nada sobre o código configurado.
 */
export const redeemAdminCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().min(1).max(128) }).parse(input))
  .handler(async ({ data, context }): Promise<RedeemAdminCodeResult> => {
    const userId = context.userId;
    const codes = parseAdminCodes(process.env.TRIP_ADMIN_CODE);

    if (codes.length === 0) {
      if (process.env.TRIP_ADMIN_CODE) {
        console.error(
          "[trip-admin-code] TRIP_ADMIN_CODE está definido mas nenhum código passou do comprimento mínimo — recurso segue desligado",
        );
      }
      return { ok: false, error: "Ativação por código está desativada neste ambiente." };
    }

    const now = Date.now();
    const estado = attempts.get(userId) ?? ADMIN_CODE_ATTEMPTS_ZERO;

    if (isAdminCodeBlocked(estado, now)) {
      const minutos = adminCodeBlockMinutesLeft(estado, now);
      return {
        ok: false,
        blocked: true,
        error: `Muitas tentativas. Tente de novo em ${minutos} min.`,
      };
    }

    if (!matchesAdminCode(data.code, codes)) {
      attempts.set(userId, registerAdminCodeFailure(estado, now));
      return { ok: false, error: "Código inválido." };
    }

    attempts.delete(userId);

    try {
      const { already } = await activateManualPremiumEntitlement(userId);
      await logRedeem(userId, already);
      return { ok: true, already };
    } catch (error) {
      console.error("[trip-admin-code] falha ao ativar entitlement", error);
      return { ok: false, error: "Não foi possível ativar seu plano agora. Tente de novo." };
    }
  });
