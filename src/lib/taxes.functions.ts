import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const lockUsdRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      request_id: z.string().uuid(),
      force: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Cotação real via AwesomeAPI (Edge Function). Mantém a trava por requisição:
    // uma vez gravado em requests.usd_rate, só recotiza se _force=true.
    const { data: out, error } = await context.supabase.functions.invoke("lock-usd-rate", {
      body: { request_id: data.request_id, force: data.force ?? false },
    });
    if (error) throw new Error(error.message);
    if (!out || (out as { error?: string }).error) {
      throw new Error((out as { error?: string })?.error ?? "usd_rate_unavailable");
    }
    return out as { rate: number; as_of: string; source: string; cached: boolean };
  });



export const confirmTaxPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      request_id: z.string().uuid(),
      paid: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("confirm_tax_payment", {
      _request_id: data.request_id,
      _paid: data.paid,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetTaxStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      traveler_id: z.string().uuid(),
      kind: z.enum(["consular_mrv", "passaporte_pf"]),
      status: z.enum(["pending", "paid", "waived"]),
      notes: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_tax_status", {
      _traveler_id: data.traveler_id,
      _kind: data.kind,
      _status: data.status,
      _notes: data.notes ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addProductToRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      request_id: z.string().uuid(),
      traveler_id: z.string().uuid().nullable(),
      product_key: z.enum(["vistos", "pass", "rot", "mil"]),
      origin: z.enum(["upsell_renovacao"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase.rpc("add_product_to_request", {
      _request_id: data.request_id,
      _traveler_id: data.traveler_id as unknown as string,
      _product_key: data.product_key,
      _origin: data.origin ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return out as { ok: boolean; product_key: string; price_cents: number; origin: string | null };
  });

