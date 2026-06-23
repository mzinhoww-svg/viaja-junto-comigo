import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const registerTaxPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      traveler_id: z.string().uuid(),
      receipt_url: z.string().min(1).max(500),
      method: z.string().max(80).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("register_tax_payment", {
      _traveler_id: data.traveler_id,
      _receipt_url: data.receipt_url,
      _method: data.method ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetTaxStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      traveler_id: z.string().uuid(),
      status: z.enum(["pending", "paid", "waived"]),
      notes: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_tax_status", {
      _traveler_id: data.traveler_id,
      _status: data.status,
      _notes: data.notes ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
