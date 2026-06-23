import { createFileRoute } from "@tanstack/react-router";
import { ScheduleWindowEditor } from "@/components/viajaly/ScheduleWindowEditor";

export const Route = createFileRoute("/console/janelas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Janelas — Viajaly Console" }] }),
  component: ConsoleWindows,
});

function ConsoleWindows() {
  return (
    <section>
      <h1 className="text-3xl font-display font-extrabold text-navy">Janelas disponíveis</h1>
      <p className="text-ink-soft text-sm mt-1">
        Cadastre as datas que os clientes podem escolher para CASV, Entrevista e PF.
      </p>
      <div className="mt-6">
        <ScheduleWindowEditor />
      </div>
    </section>
  );
}
