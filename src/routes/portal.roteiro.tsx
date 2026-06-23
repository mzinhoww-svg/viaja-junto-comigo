import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { RoteiroCardPortal } from "@/components/viajaly/RoteiroCard";
import { BriefingForm } from "@/components/viajaly/BriefingForm";
import { useMyRequest, useRequestRealtime } from "@/hooks/useJourney";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/portal/roteiro")({
  ssr: false,
  head: () => ({ meta: [{ title: "Roteiro — Viajaly" }] }),
  component: PortalRoteiro,
});

function PortalRoteiro() {
  const nav = useNavigate();
  const req = useMyRequest();
  useRequestRealtime(req.data?.id);
  const [tab, setTab] = useState<"briefing" | "entrega">("briefing");
  if (!req.data) return null;
  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-24 anim-vfade">
        <button onClick={() => nav({ to: "/portal" })} className="inline-flex items-center gap-1 text-ink-soft text-sm hover:text-coral mb-4">
          <ChevronLeft size={16} /> Hub
        </button>
        <h1 className="text-2xl font-display font-extrabold text-navy mb-1">Roteiro</h1>
        <p className="text-sm text-ink-soft mb-3">Briefing guiado · ~6 min</p>
        <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-cream/60 p-3 text-xs text-ink-soft">
          O roteiro é uma <b>sugestão de itinerário</b>; reservas e compras são feitas por você ou com nosso apoio.
        </div>
        <div className="flex gap-1 border-b border-[var(--color-border)] mb-4">
          {(["briefing","entrega"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab===t ? "border-coral text-coral" : "border-transparent text-ink-soft"}`}>
              {t === "briefing" ? "Briefing" : "Entrega"}
            </button>
          ))}
        </div>
        {tab === "briefing" && <BriefingForm requestId={req.data.id} productKey="roteiro" />}
        {tab === "entrega" && (
          <RoteiroCardPortal requestId={req.data.id} phone={req.data.whatsapp_e164 ?? req.data.lead_phone} />
        )}
      </div>
    </PhoneFrame>
  );
}
