import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_requests",
  title: "Listar meus pedidos",
  description:
    "Lista pedidos visíveis para o usuário autenticado (respeita RLS: clientes só veem seus pedidos; staff vê os pedidos da agência).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Máximo de itens (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("requests_safe")
      .select(
        "id, lead_name, lead_email, proposal_status, payment_status, tax_status, assigned_to, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { requests: data ?? [] },
    };
  },
});
