import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export type NavFn = (opts: { to: string }) => void;

export type GoogleLoginOptions = {
  redirectTo: string;
  next: string;
  nav: NavFn;
  requireAdmin?: boolean;
  successMessage?: string;
  onDone?: () => void;
};

/**
 * Fluxo compartilhado de login com Google (VJT-011d).
 * - Portal do cliente: `requireAdmin=false` — qualquer sessão vale.
 * - Console da agência: `requireAdmin=true` — se o profile não for admin,
 *   desloga e informa o usuário.
 *
 * Extraído em módulo próprio para permitir testes unitários com mocks de
 * `lovable`, `supabase` e `sonner`, sem montar as rotas inteiras.
 */
export async function loginWithGoogle(opts: GoogleLoginOptions): Promise<void> {
  const { redirectTo, next, nav, requireAdmin, successMessage, onDone } = opts;
  try {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectTo,
    });
    if (result.error) {
      toast.error("Não conseguimos entrar com o Google. Tente novamente.");
      onDone?.();
      return;
    }
    if (result.redirected) return;

    if (requireAdmin) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        toast.error("Sessão não encontrada.");
        onDone?.();
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (prof?.role !== "admin") {
        await supabase.auth.signOut();
        toast.error("Esta conta não tem acesso ao console.");
        onDone?.();
        return;
      }
    }

    toast.success(successMessage ?? "Bem-vindo(a)!");
    nav({ to: next });
  } catch {
    toast.error("Não conseguimos entrar com o Google. Tente novamente.");
    onDone?.();
  }
}
