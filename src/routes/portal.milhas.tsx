import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { MilhasCardPortal } from "@/components/viajaly/MilhasCard";
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
  if (!req.data) return null;
  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-24 anim-vfade">
        <button onClick={() => nav({ to: "/portal" })} className="inline-flex items-center gap-1 text-ink-soft text-sm hover:text-coral mb-4">
          <ChevronLeft size={16} /> Hub
        </button>
        <MilhasCardPortal requestId={req.data.id} />
      </div>
    </PhoneFrame>
  );
}
