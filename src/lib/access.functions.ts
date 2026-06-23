import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin gera novo código de 6 dígitos (e renova expiração) para uma solicitação. */
export const regenerateAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ request_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("regenerate_access_code", {
      _request_id: data.request_id,
    });
    if (error) throw new Error(error.message);
    return res as { access_code: string; expires_at: string };
  });
