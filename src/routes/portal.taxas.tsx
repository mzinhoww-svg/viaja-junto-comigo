import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMyRequest, useRequestRealtime } from "@/hooks/useJourney";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { TaxList } from "@/components/viajaly/TaxList";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignOut } from "./portal";
import { ChevronLeft, LogOut } from "lucide-react";

export const Route = createFileRoute("/portal/taxas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Taxas consulares — Viajaly" }] }),
  component: PortalTaxes,
});

function PortalTaxes() {
  const req = useMyRequest();
  useRequestRealtime(req.data?.id);
  const signOut = useSignOut();
  const nav = useNavigate();

  useEffect(() => {
    const r = req.data;
    if (!r) return;
    if (r.payment_status !== "paid") nav({ to: "/portal" });
  }, [req.data, nav]);

  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-24 anim-vfade">
        <div className="flex items-center justify-between">
          <button onClick={() => nav({ to: "/portal" })} className="flex items-center gap-1 text-ink-soft text-sm hover:text-coral">
            <ChevronLeft size={16} /> Jornada
          </button>
          <Logo size={28} />
          <button onClick={signOut} className="text-ink-muted hover:text-coral p-2" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>

        <h1 className="mt-6 text-2xl font-display font-extrabold text-navy">Taxas consulares</h1>
        <p className="mt-1 text-ink-soft text-sm">Anexe o comprovante da taxa MRV de cada viajante.</p>

        <div className="mt-6">
          {!req.data ? <Skeleton className="h-40 rounded-2xl" /> : <TaxList requestId={req.data.id} variant="portal" />}
        </div>
      </div>
    </PhoneFrame>
  );
}
