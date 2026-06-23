import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const saveIntentWish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      intent_id: z.string().uuid(),
      wish_dates: z.array(dateStr).max(10).default([]),
      wish_period: z.enum(["morning", "afternoon", "any"]).optional(),
      consulate: z.string().max(20).optional(),
      notes: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("save_intent_wish", {
      _intent_id: data.intent_id,
      _wish_dates: data.wish_dates,
      _wish_period: data.wish_period ?? "",
      _consulate: data.consulate ?? "",
      _notes: data.notes ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const confirmIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      intent_id: z.string().uuid(),
      confirmed_date: dateStr,
      consulate: z.string().max(20).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("confirm_intent", {
      _intent_id: data.intent_id,
      _confirmed_date: data.confirmed_date,
      _consulate: data.consulate ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reopenIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ intent_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("reopen_intent", { _intent_id: data.intent_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertScheduleWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      slots: z.record(z.string(), z.record(z.string(), z.array(dateStr))).optional(),
      released_quinzenas: z.array(z.string()).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("upsert_schedule_window", {
      _slots: (data.slots ?? null) as never,
      _released: (data.released_quinzenas ?? null) as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
