import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  ADMIN_CODE_ATTEMPTS_ZERO,
  adminCodeBlockMinutesLeft,
  isAdminCodeBlocked,
  matchesAdminCode,
  parseAdminCodes,
  parseAdminEmail,
  registerAdminCodeFailure,
  type AdminCodeAttempts,
} from "@/lib/trip-admin-code";

export type AdminLoginResult =
  { ok: true; email: string; hashed_token: string } | { ok: false; error: string };

/**
 * Tentativas por IP (o login não tem usuário ainda, então a chave é o IP).
 * Mesma ressalva do resgate de código: memória do processo, atrito contra
 * força bruta ingênua — o controle forte é a entropia do código.
 */
const attempts = new Map<string, AdminCodeAttempts>();

/**
 * Login da equipe por código (VJT-011d) — entra direto no Viajaly Trip sem
 * esperar e-mail, para QA, demo e suporte.
 *
 * O código NÃO autentica um e-mail digitado na tela: ele abre exclusivamente
 * a conta configurada em `TRIP_ADMIN_EMAIL`. É uma credencial compartilhada
 * de uma conta específica, não uma chave mestra capaz de entrar na conta de
 * qualquer cliente — a diferença importa se o código vazar.
 *
 * A sessão é criada pelo mesmo mecanismo já usado no login do portal
 * (`admin.generateLink` + `verifyOtp` no client), então não há segundo
 * caminho de autenticação no produto.
 *
 * Procedimento operacional: `docs/runbook-ativacao-manual-entitlements.md`
 * (Caminho A2).
 */
export const loginWithAdminCode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ code: z.string().min(1).max(128) }).parse(input))
  .handler(async ({ data }): Promise<AdminLoginResult> => {
    const codes = parseAdminCodes(process.env.TRIP_ADMIN_CODE);
    const email = parseAdminEmail(process.env.TRIP_ADMIN_EMAIL);

    if (codes.length === 0 || !email) {
      return { ok: false, error: "Acesso da equipe não está configurado neste ambiente." };
    }

    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    const now = Date.now();
    const estado = attempts.get(ip) ?? ADMIN_CODE_ATTEMPTS_ZERO;

    if (isAdminCodeBlocked(estado, now)) {
      const minutos = adminCodeBlockMinutesLeft(estado, now);
      return { ok: false, error: `Muitas tentativas. Tente de novo em ${minutos} min.` };
    }

    if (!matchesAdminCode(data.code, codes)) {
      attempts.set(ip, registerAdminCodeFailure(estado, now));
      return { ok: false, error: "Código inválido." };
    }

    attempts.delete(ip);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // A conta da equipe pode ainda não existir (ambiente novo, banco limpo):
    // cria já confirmada antes de gerar o link, em vez de exigir um cadastro
    // manual no painel do Supabase só para o código funcionar.
    let link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error || !link.data?.properties?.hashed_token) {
      const created = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
      if (created.error && !/already/i.test(created.error.message)) {
        console.error("[admin-login] falha ao criar a conta da equipe", created.error);
        return { ok: false, error: "Não foi possível entrar agora. Tente de novo." };
      }
      link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    }

    const hashedToken = link.data?.properties?.hashed_token;
    if (link.error || !hashedToken) {
      console.error("[admin-login] falha ao gerar o link de acesso", link.error);
      return { ok: false, error: "Não foi possível entrar agora. Tente de novo." };
    }

    // O mesmo código que abre a sessão já libera o Premium: quem entra por
    // aqui é equipe testando o produto inteiro, e obrigar a digitar o código
    // de novo em /trip/mais seria só uma etapa a mais. Best-effort — falhar
    // aqui não pode impedir o login que já foi autorizado.
    const userId = link.data?.user?.id;
    if (userId) {
      try {
        const { activateManualPremiumEntitlement } =
          await import("@/lib/premium-entitlement.server");
        await activateManualPremiumEntitlement(userId);
        await supabaseAdmin.from("audit_log").insert({
          actor: userId,
          action: "trip_admin_login",
          target: userId,
          payload: { origem: "manual" },
        });
      } catch (error) {
        console.error("[admin-login] login ok, mas falhou ativar premium/auditar", error);
      }
    }

    return { ok: true, email, hashed_token: hashedToken };
  });
