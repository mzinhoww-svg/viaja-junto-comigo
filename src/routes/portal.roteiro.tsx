import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { RoteiroCardPortal } from "@/components/viajaly/RoteiroCard";
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
  if (!req.data) return null;
  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-24 anim-vfade">
        <button onClick={() => nav({ to: "/portal" })} className="inline-flex items-center gap-1 text-ink-soft text-sm hover:text-coral mb-4">
          <ChevronLeft size={16} /> Hub
        </button>
        <RoteiroCardPortal requestId={req.data.id} phone={req.data.whatsapp_e164 ?? req.data.lead_phone} />
      </div>
    </PhoneFrame>
  );
}
