import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyRequestsTool from "./tools/list-my-requests";
import getRequestTool from "./tools/get-request";
import listPipelineTool from "./tools/list-pipeline";
import whoAmITool from "./tools/whoami";

// The OAuth issuer MUST be the direct Supabase host — on publish, SUPABASE_URL is
// rewritten to the .lovable.cloud proxy, which mcp-js rejects (RFC 8414 issuer mismatch).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "viajaly-mcp",
  title: "Viajaly Agent Tools",
  version: "0.1.0",
  instructions:
    "Ferramentas para consultores e clientes Viajaly. Use `whoami` para conferir a identidade autenticada, `list_my_requests` para listar pedidos visíveis, `get_request` para detalhar um pedido pelo id, e `list_pipeline` (staff apenas) para ver o funil da agência.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoAmITool, listMyRequestsTool, getRequestTool, listPipelineTool],
});
