import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { MessageThread } from "@/components/viajaly/MessageThread";
import { useMyRequest } from "@/hooks/useJourney";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/portal/mensagens")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mensagens — Viajaly" }] }),
  component: PortalMensagens,
});

function PortalMensagens() {
  const nav = useNavigate();
  const req = useMyRequest();
  if (!req.data) return null;
  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-24 anim-vfade">
        <button onClick={() => nav({ to: "/portal" })} className="inline-flex items-center gap-1 text-ink-soft text-sm hover:text-coral mb-4">
          <ChevronLeft size={16} /> Hub
        </button>
        <h1 className="text-2xl font-display font-extrabold text-navy mb-4">Conversa com a Letícia</h1>
        <MessageThread requestId={req.data.id} isAdmin={false} />
      </div>
    </PhoneFrame>
  );
}
