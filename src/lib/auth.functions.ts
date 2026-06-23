import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Login do cliente apenas com código de 6 dígitos.
 * - Rate-limit por IP (15 min / 5 tentativas).
 * - Rate-limit por código (5 erros no mesmo código em 15 min → bloqueia 30 min).
 * - Expiração: requests.access_code_expires_at.
 * - Devolve mensagens estruturadas via Error.message com prefixo "CODE:" para o front mapear.
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
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Rate-limit por IP
    const { data: byIp } = await supabaseAdmin
      .from("access_code_attempts")
      .select("success, at")
      .eq("ip", ip)
      .gte("at", thirtyMinAgo.toISOString())
      .order("at", { ascending: false })
      .limit(20);
    const ipFails = (byIp ?? []).filter((a) => !a.success && new Date(a.at) >= fifteenMinAgo);
    if (ipFails.length >= 5) {
      const oldest = ipFails[ipFails.length - 1];
      const unlockAt = new Date(new Date(oldest.at).getTime() + 30 * 60 * 1000);
      const secs = Math.max(60, Math.ceil((unlockAt.getTime() - now.getTime()) / 1000));
      throw new Error(`RATE_LIMIT:${secs}`);
    }

    // Rate-limit por código tentado (últimos 4 dígitos não bastam — usamos código completo internamente)
    const { data: byCode } = await supabaseAdmin
      .from("access_code_attempts")
      .select("success, at")
      .eq("attempted_code", data.code)
      .gte("at", fifteenMinAgo.toISOString())
      .order("at", { ascending: false })
      .limit(10);
    const codeFails = (byCode ?? []).filter((a) => !a.success);
    if (codeFails.length >= 5) {
      throw new Error("CODE_BLOCKED");
    }

    // Localiza solicitação pelo código
    const { data: matches } = await supabaseAdmin
      .from("requests")
      .select("id, access_code, lead_email, access_code_expires_at")
      .eq("access_code", data.code)
      .limit(2);

    const req = matches && matches.length === 1 ? matches[0] : null;
    const expired = !!req && req.access_code_expires_at && new Date(req.access_code_expires_at) < now;
    const ok = !!req && !expired;
    const email = req?.lead_email?.toLowerCase() ?? "";
    const maskedCode = data.code; // gravamos completo p/ correlacionar; UI mascara ao mostrar

    await supabaseAdmin.from("access_code_attempts").insert({
      email,
      ip,
      success: ok,
      request_id: req?.id ?? null,
      attempted_code: maskedCode,
    });

    if (!req) throw new Error("INVALID");
    if (expired) throw new Error("EXPIRED");

    // Gera magic link de uso único → front consome via verifyOtp.
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      throw new Error("LOGIN_FAILED");
    }

    return {
      ok: true,
      hashed_token: link.properties.hashed_token,
      token_type: "magiclink" as const,
      email,
      request_id: req.id,
    };
  });

/**
 * Reenvio: aceita um código e, se reconhecido, registra um pedido (notificação)
 * para o consultor reenviar via WhatsApp. Cooldown de 5min por request via RPC.
 */
export const requestCodeResend = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      code: z.string().regex(/^\d{6}$/),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await supabaseAdmin
      .from("requests")
      .select("id")
      .eq("access_code", data.code)
      .maybeSingle();
    if (!req) {
      // Mesma resposta para não vazar se o código existe.
      return { ok: true };
    }
    const { error } = await supabaseAdmin.rpc("request_code_resend", { _request_id: req.id });
    if (error) {
      if (error.message?.includes("cooldown")) throw new Error("RESEND_COOLDOWN");
      throw new Error("RESEND_FAILED");
    }
    return { ok: true };
  });
