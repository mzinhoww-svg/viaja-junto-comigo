import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ProductEnum = z.enum(["vistos", "passaporte", "roteiro", "milhas"]);

const LeadPayload = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(8).max(40),
  products: z.array(ProductEnum).max(4).default([]),
  message: z.string().trim().max(2000).optional().default(""),
  consent: z.literal(true, { errorMap: () => ({ message: "Consentimento obrigatório" }) }),
  consent_text: z.string().trim().min(10).max(500),
  started_at_ms: z.number().int().nonnegative(),
  website: z.string().optional().default(""), // honeypot
  turnstile_token: z.string().optional().default(""),
});

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((input) => LeadPayload.parse(input))
  .handler(async ({ data }) => {
    const req = getWebRequest();
    const ip =
      req?.headers.get("cf-connecting-ip") ??
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req?.headers.get("x-real-ip") ??
      "unknown";

    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: res, error } = await supabase.rpc("submit_lead" as never, {
      _payload: data as never,
      _client_ip: ip,
    } as never);
    if (error) throw new Error(error.message);
    return res as { ok: boolean; request_id?: string };
  });
