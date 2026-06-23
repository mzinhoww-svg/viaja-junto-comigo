import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveDs160Draft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      traveler_id: z.string().uuid(),
      form: z.record(z.string(), z.unknown()),
      completion_pct: z.number().int().min(0).max(100),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("save_ds160_draft", {
      _traveler_id: data.traveler_id,
      _form: data.form as never,
      _completion_pct: data.completion_pct,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitDs160 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ traveler_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("submit_ds160", {
      _traveler_id: data.traveler_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const validateDs160 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      traveler_id: z.string().uuid(),
      approve: z.boolean(),
      notes: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("validate_ds160", {
      _traveler_id: data.traveler_id,
      _approve: data.approve,
      _notes: data.notes ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
