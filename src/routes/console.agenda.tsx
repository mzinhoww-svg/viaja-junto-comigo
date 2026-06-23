import { createFileRoute } from "@tanstack/react-router";
import { AgencyCalendar, PendingIntents } from "@/components/viajaly/AgencyCalendar";

export const Route = createFileRoute("/console/agenda")({
  ssr: false,
  head: () => ({ meta: [{ title: "Agenda — Viajaly Console" }] }),
  component: ConsoleAgenda,
});

function ConsoleAgenda() {
  return (
    <section>
      <h1 className="text-3xl font-display font-extrabold text-navy">Agenda</h1>
      <p className="text-ink-soft text-sm mt-1">Visão geral dos agendamentos confirmados e pendentes.</p>

      <div className="mt-6 grid lg:grid-cols-[1fr_360px] gap-6">
        <AgencyCalendar />
        <PendingIntents />
      </div>
    </section>
  );
}
