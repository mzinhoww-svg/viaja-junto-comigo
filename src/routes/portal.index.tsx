import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMyRequest, useJourney, useRequestRealtime } from "@/hooks/useJourney";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { StepCard } from "@/components/viajaly/StepCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductsHub } from "@/components/viajaly/ProductsHub";
import { NotificationBell } from "@/components/viajaly/NotificationBell";
import { useSignOut } from "./portal";
import { LogOut, MessageSquare } from "lucide-react";

const STEP_TO_ROUTE: Record<string, "/portal/proposta" | "/portal/contrato" | "/portal/pagamento" | "/portal/documentos" | "/portal/ds160" | "/portal/taxas" | "/portal/agenda" | "/portal/conclusao" | "/portal/passaporte" | "/portal/roteiro" | "/portal/milhas"> = {
  proposta: "/portal/proposta",
  contrato: "/portal/contrato",
  pagamento: "/portal/pagamento",
  documentos: "/portal/documentos",
  taxas: "/portal/taxas",
  agenda: "/portal/agenda",
  conclusao: "/portal/conclusao",
  briefing_passaporte: "/portal/passaporte",
  entrega_passaporte: "/portal/passaporte",
  briefing_roteiro: "/portal/roteiro",
  entrega_roteiro: "/portal/roteiro",
  briefing_milhas: "/portal/milhas",
  entrega_milhas: "/portal/milhas",
};

export const Route = createFileRoute("/portal/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sua jornada — Viajaly" }] }),
  component: PortalHome,
});

function PortalHome() {
  const req = useMyRequest();
  useRequestRealtime(req.data?.id);
  const journey = useJourney(req.data?.id);
  const signOut = useSignOut();
  const nav = useNavigate();

  useEffect(() => {
    const r = req.data;
    if (!r) return;
    const s = r.proposal_status;
    if (s === "sent" || s === "viewed" || s === "draft") { nav({ to: "/portal/proposta" }); return; }
    if (s === "accepted") {
      if (!r.contract_signed) { nav({ to: "/portal/contrato" }); return; }
      if (r.payment_status !== "paid") { nav({ to: "/portal/pagamento" }); return; }
      // Pago: libera Documentos / DS-160 / Taxas em paralelo (fica no hub).
    }
  }, [req.data, nav]);

  const done = journey.data?.filter((s) => s.status === "done").length ?? 0;
  const pct = Math.round((done / 7) * 100);
  const next = journey.data?.find((s) => s.status === "active")?.label;

  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-24 anim-vfade">
        <div className="flex items-center justify-between">
          <Logo size={32} />
          <div className="flex items-center">
            <NotificationBell />
            <button onClick={signOut} className="text-ink-muted hover:text-coral p-2" aria-label="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {!req.data ? (
          <div className="mt-8 p-6 rounded-2xl bg-white border border-[var(--color-border)]">
            <p className="text-ink-soft text-sm">
              Você ainda não tem uma proposta ativa. Entre em contato com a Letícia para receber seu orçamento.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 p-5 rounded-3xl bg-navy text-cream">
              <p className="text-xs uppercase tracking-wider opacity-70">Olá, {req.data.lead_name?.split(" ")[0]}</p>
              <h1 className="mt-1 text-2xl font-display font-extrabold text-cream">Sua jornada</h1>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-4xl font-display font-extrabold text-cream">{pct}%</span>
                {next && <span className="text-sm opacity-80">Agora: <b>{next}</b></span>}
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full bg-coral transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {req.data.payment_status === "paid" && (
              <div className="mt-6 grid grid-cols-3 gap-2">
                <button
                  onClick={() => nav({ to: "/portal/ds160" })}
                  className="rounded-2xl border border-[var(--color-border)] bg-white p-3 text-left hover:border-coral transition"
                >
                  <p className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Formulário</p>
                  <p className="mt-1 font-display font-bold text-navy text-sm">DS-160</p>
                </button>
                <button
                  onClick={() => nav({ to: "/portal/taxas" })}
                  className="rounded-2xl border border-[var(--color-border)] bg-white p-3 text-left hover:border-coral transition"
                >
                  <p className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Pagamento</p>
                  <p className="mt-1 font-display font-bold text-navy text-sm">Taxa MRV</p>
                </button>
                <button
                  onClick={() => nav({ to: "/portal/agenda" })}
                  className="rounded-2xl border border-[var(--color-border)] bg-white p-3 text-left hover:border-coral transition"
                >
                  <p className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Datas</p>
                  <p className="mt-1 font-display font-bold text-navy text-sm">Agendamentos</p>
                </button>
              </div>
            )}

            <ProductsHub requestId={req.data.id} />

            <h2 className="mt-8 mb-3 text-sm font-display font-bold text-navy uppercase tracking-wider">Etapas</h2>
            {journey.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
            ) : (
              <div className="space-y-2">
                {journey.data?.map((s) => {
                  const target = STEP_TO_ROUTE[s.key];
                  return (
                    <StepCard
                      key={s.key}
                      idx={s.idx}
                      label={s.label}
                      status={s.status}
                      onClick={target ? () => nav({ to: target }) : undefined}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </PhoneFrame>
  );
}
