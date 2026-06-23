import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { BriefingForm } from "@/components/viajaly/BriefingForm";
import { useMyRequest, useRequestRealtime } from "@/hooks/useJourney";
import { ChevronLeft, Plane } from "lucide-react";

const LABELS: Record<string, { label: string; sub: string; cls: string }> = {
  coletando:  { label: "Coletando dados",       sub: "Estamos reunindo o que precisamos.",       cls: "bg-slate-100 text-slate-800" },
  em_emissao: { label: "Em emissão",            sub: "Processo na Polícia Federal em curso.",    cls: "bg-amber-100 text-amber-800" },
  pronto:     { label: "Pronto para retirada",  sub: "Combine a retirada com a Letícia.",        cls: "bg-emerald-100 text-emerald-800" },
  entregue:   { label: "Entregue",              sub: "Passaporte já está com você.",             cls: "bg-emerald-50 text-emerald-700" },
};

export const Route = createFileRoute("/portal/passaporte")({
  ssr: false,
  head: () => ({ meta: [{ title: "Passaporte — Viajaly" }] }),
  component: PortalPassaporte,
});

function PortalPassaporte() {
  const nav = useNavigate();
  const req = useMyRequest();
  useRequestRealtime(req.data?.id);
  const r = req.data;
  const [tab, setTab] = useState<"briefing" | "entrega">("briefing");
  if (!r) return null;
  const meta = LABELS[r.passport_status ?? "coletando"] ?? LABELS.coletando;
  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-24 anim-vfade">
        <button onClick={() => nav({ to: "/portal" })} className="inline-flex items-center gap-1 text-ink-soft text-sm hover:text-coral mb-4">
          <ChevronLeft size={16} /> Hub
        </button>
        <h1 className="text-2xl font-display font-extrabold text-navy mb-1">Passaporte</h1>
        <p className="text-sm text-ink-soft mb-3">Briefing guiado · ~8 min</p>
        <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-cream/60 p-3 text-xs text-ink-soft">
          A taxa da Polícia Federal é paga <b>direto ao governo</b>, à parte da consultoria.
        </div>

        <div className="flex gap-1 border-b border-[var(--color-border)] mb-4">
          {(["briefing","entrega"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab===t ? "border-coral text-coral" : "border-transparent text-ink-soft"}`}>
              {t === "briefing" ? "Briefing" : "Entrega"}
            </button>
          ))}
        </div>

        {tab === "briefing" && <BriefingForm requestId={r.id} productKey="passaporte" />}

        {tab === "entrega" && (
          <>
            <div className="rounded-3xl bg-white border border-[var(--color-border)] p-6 text-center">
              <Plane size={32} className="mx-auto text-coral" />
              <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold ${meta.cls}`}>{meta.label}</span>
              <p className="mt-3 text-sm text-ink-soft">{meta.sub}</p>
            </div>
            {r.passport_notes && (
              <div className="mt-4 rounded-2xl bg-white border border-[var(--color-border)] p-5">
                <h3 className="font-display font-bold text-navy text-sm">Mensagem da consultora</h3>
                <p className="mt-2 text-sm text-ink whitespace-pre-line">{r.passport_notes}</p>
              </div>
            )}
          </>
        )}
      </div>
    </PhoneFrame>
  );
}
