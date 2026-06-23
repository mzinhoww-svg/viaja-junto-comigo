import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { MilhasCardPortal } from "@/components/viajaly/MilhasCard";
import { BriefingForm } from "@/components/viajaly/BriefingForm";
import { useMyRequest, useRequestRealtime } from "@/hooks/useJourney";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/portal/milhas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Milhas — Viajaly" }] }),
  component: PortalMilhas,
});

function PortalMilhas() {
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
        <h1 className="text-2xl font-display font-extrabold text-navy mb-1">Milhas</h1>
        <p className="text-sm text-ink-soft mb-3">Briefing guiado · ~6 min</p>
        <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-cream/60 p-3 text-xs text-ink-soft">
          A Viajaly faz <b>consultoria e otimização de milhas</b> — não emite nem vende milhas.
        </div>
        <div className="flex gap-1 border-b border-[var(--color-border)] mb-4">
          {(["briefing","entrega"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab===t ? "border-coral text-coral" : "border-transparent text-ink-soft"}`}>
              {t === "briefing" ? "Briefing" : "Entrega"}
            </button>
          ))}
        </div>
        {tab === "briefing" && <BriefingForm requestId={req.data.id} productKey="milhas" />}
        {tab === "entrega" && <MilhasCardPortal requestId={req.data.id} />}
      </div>
    </PhoneFrame>
  );
}
