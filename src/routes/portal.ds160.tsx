import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { useMyRequest, useRequestRealtime } from "@/hooks/useJourney";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignOut } from "./portal";
import { ChevronLeft, LogOut } from "lucide-react";

// DS160Form é o maior componente do portal — carrega sob demanda nesta rota.
const DS160Form = lazy(() => import("@/components/viajaly/DS160Form").then((m) => ({ default: m.DS160Form })));

export const Route = createFileRoute("/portal/ds160")({
  ssr: false,
  head: () => ({ meta: [{ title: "DS-160 — Viajaly" }] }),
  component: PortalDS160,
});

function PortalDS160() {
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

        <div className="mt-6">
          {!req.data ? <Skeleton className="h-40 rounded-2xl" /> : (
            <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
              <DS160Form requestId={req.data.id} variant="portal" />
            </Suspense>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
