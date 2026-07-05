import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Captura o IP do signatário no servidor (não confia no cliente).
 * Prioriza x-forwarded-for (primeiro IP da cadeia), depois cf-connecting-ip,
 * depois x-real-ip e por fim o socket do request.
 */
function readClientIp(): string {
  const xff = getRequestHeader("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf;
  const real = getRequestHeader("x-real-ip");
  if (real) return real;
  try {
    const req = getRequest();
    // @ts-expect-error — runtime-dependent socket access
    return req?.socket?.remoteAddress ?? "";
  } catch {
    return "";
  }
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export const signContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      request_id: z.string().uuid(),
      name: z.string().min(4).max(200),
      body_html: z.string().min(50),
      body_sha256: z.string().length(64),
      accepted_terms: z.literal(true),
      cpf: z.string().max(20).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Recomputa hash no servidor — garante integridade do snapshot enviado.
    const serverHash = sha256Hex(data.body_html).toLowerCase();
    if (serverHash !== data.body_sha256.toLowerCase()) {
      throw new Error("hash_mismatch");
    }
    const ip = readClientIp();
    const userAgent = getRequestHeader("user-agent") ?? "";

    const { data: out, error } = await context.supabase.rpc("sign_contract_v2", {
      _request_id: data.request_id,
      _name: data.name,
      _body_html: data.body_html,
      _body_sha256: serverHash,
      _ip: ip,
      _user_agent: userAgent,
      _accepted: true,
      _cpf: data.cpf ?? null,
    } as never);
    if (error) throw new Error(error.message);

    const result = out as {
      contract_id: string;
      signed_at: string;
      ip: string;
      user_agent: string;
      body_sha256: string;
    };
    return result;
  });

export const setContractPdfPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      contract_id: z.string().uuid(),
      path: z.string().min(5),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_contract_pdf_path", {
      _contract_id: data.contract_id,
      _path: data.path,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
