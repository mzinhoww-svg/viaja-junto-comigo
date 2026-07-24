import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_pipeline",
  title: "Funil da agência (staff)",
  description:
    "Lista pedidos por status (proposta, pagamento, taxas). Uso interno da equipe — clientes só verão seus próprios pedidos, se algum.",
  inputSchema: {
    status: z
      .enum(["draft", "sent", "accepted", "declined"])
      .optional()
      .describe("Filtro opcional por proposal_status."),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("requests_safe")
      .select(
        "id, lead_name, lead_email, proposal_status, payment_status, tax_status, assigned_to, created_at, proposal_total_cents",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) query = query.eq("proposal_status", status);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { pipeline: data ?? [] },
    };
  },
});
