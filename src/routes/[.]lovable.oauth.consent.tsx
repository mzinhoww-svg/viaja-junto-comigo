import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AuthorizationDetails = {
  client?: { name?: string | null; client_uri?: string | null } | null;
  scope?: string | null;
  redirect_uri?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
} | null;

type OAuthAuth = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};

function oauth(): OAuthAuth {
  // Beta namespace on @supabase/supabase-js; typed locally to avoid grepping SDK internals.
  return (supabase.auth as unknown as { oauth: OAuthAuth }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/portal/login", search: { next } as never });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center px-6 text-navy">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold">Não foi possível carregar a autorização</h1>
        <p className="mt-2 text-sm text-ink-soft">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou uma URL de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "um aplicativo";
  const scope = details?.scope ?? "openid email profile";

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10 bg-appbg text-navy">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-[var(--color-border)] shadow-[0_20px_60px_-30px_rgba(16,32,74,.4)]">
        <h1 className="text-2xl font-display font-extrabold">
          Conectar {clientName} à sua conta Viajaly
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Isso permite que {clientName} use a Viajaly em seu nome, com as mesmas permissões
          e políticas de acesso da sua conta.
        </p>

        <ul className="mt-4 text-sm text-ink-soft space-y-1 list-disc pl-5">
          <li>Compartilhar seu perfil básico e e-mail</li>
          <li>Chamar as ferramentas habilitadas neste aplicativo enquanto você estiver conectado</li>
        </ul>

        <p className="mt-3 text-[11px] text-ink-muted uppercase tracking-wider">
          Permissões solicitadas
        </p>
        <p className="mt-1 text-xs text-ink-soft font-mono break-all">{scope}</p>

        {error && (
          <p role="alert" className="mt-4 text-sm text-coral">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 h-11 rounded-full bg-coral hover:bg-[var(--color-coral-hover)] text-cream font-semibold disabled:opacity-60"
          >
            {busy ? "Aguarde…" : "Aprovar"}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 h-11 rounded-full border border-[var(--color-border)] text-navy hover:bg-cream font-semibold disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>

        <p className="mt-6 text-xs text-ink-muted">
          Isto não substitui as regras de acesso do banco (RLS) — as ferramentas só verão o que
          você já pode ver.
        </p>
      </div>
    </main>
  );
}
