import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Login do cliente apenas com código de 6 dígitos.
 * - Rate-limit: 5 tentativas / 15 min por IP. Bloqueia por 30 min após exceder.
 * - O código por si só NÃO é credencial: ao validar, gera um magic link de uso único
 *   (action_link) que o front consome via verifyOtp para criar a sessão.
 */
export const loginWithCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      code: z.string().regex(/^\d{6}$/, "Código deve ter 6 dígitos"),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000);
    const blockWindowStart = new Date(now.getTime() - 30 * 60 * 1000);

    // Rate-limit por IP
    const { data: recent } = await supabaseAdmin
      .from("access_code_attempts")
      .select("success, at")
      .eq("ip", ip)
      .gte("at", blockWindowStart.toISOString())
      .order("at", { ascending: false })
      .limit(20);
    const fails = (recent ?? []).filter((a) => !a.success && new Date(a.at) >= windowStart);
    if (fails.length >= 5) {
      throw new Error("Muitas tentativas. Tente novamente em alguns minutos.");
    }

    // Localiza solicitação pelo código
    const { data: matches } = await supabaseAdmin
      .from("requests")
      .select("id, access_code, lead_email")
      .eq("access_code", data.code)
      .limit(2);

    const req = matches && matches.length === 1 ? matches[0] : null;
    const ok = !!req;
    const email = req?.lead_email?.toLowerCase() ?? "";

    await supabaseAdmin.from("access_code_attempts").insert({ email, ip, success: ok });

    if (!ok) {
      throw new Error("Código inválido.");
    }

    // Gera magic link de uso único → front consome via verifyOtp.
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      throw new Error("Não foi possível concluir o login. Tente novamente.");
    }

    return {
      ok: true,
      hashed_token: link.properties.hashed_token,
      token_type: "magiclink" as const,
      email,
    };
  });
