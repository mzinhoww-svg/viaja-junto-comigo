import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Quem sou eu",
  description: "Retorna o usuário autenticado (id, email) e seu papel na agência Viajaly.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId() ?? "";
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, role, agency_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const profile = data ?? { id: userId, email: ctx.getUserEmail() ?? null, role: null };
    return {
      content: [{ type: "text", text: JSON.stringify(profile) }],
      structuredContent: { profile },
    };
  },
});
