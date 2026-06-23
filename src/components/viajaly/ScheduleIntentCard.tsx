import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarCheck, Clock, Send, Plus, X, ExternalLink, RotateCcw } from "lucide-react";
import {
  SERVICE_LABEL,
  SERVICE_REQUIRED,
  CONSULATES,
  CONSULATE_LABEL,
  PERIOD_LABEL,
  googleCalUrl,
  type Service,
} from "@/lib/schedule-shared";
import { saveIntentWish, confirmIntent, reopenIntent } from "@/lib/schedule.functions";

export type Intent = {
  id: string;
  traveler_id: string;
  service: Service;
  status: "open" | "sent" | "confirmed";
  wish_dates: string[] | null;
  wish_period: string | null;
  consulate: string | null;
  notes: string | null;
  confirmed_date: string | null;
};

export function ScheduleIntentCard({
  intent,
  travelerName,
  availableDates,
  variant,
  requestId,
}: {
  intent: Intent;
  travelerName: string;
  availableDates: string[]; // YYYY-MM-DD list released by agency for (service, consulate)
  variant: "portal" | "console";
  requestId: string;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveIntentWish);
  const confirmFn = useServerFn(confirmIntent);
  const reopenFn = useServerFn(reopenIntent);

  const [consulate, setConsulate] = useState<string>(intent.consulate ?? "SP");
  const [period, setPeriod] = useState<string>(intent.wish_period ?? "any");
  const [wishDates, setWishDates] = useState<string[]>(intent.wish_dates ?? []);
  const [notes, setNotes] = useState(intent.notes ?? "");
  const [confirmDate, setConfirmDate] = useState("");

  const optional = !SERVICE_REQUIRED[intent.service];
  const isConfirmed = intent.status === "confirmed";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["agenda", requestId] });
    qc.invalidateQueries({ queryKey: ["journey", requestId] });
    qc.invalidateQueries({ queryKey: ["agenda-overview"] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      await saveFn({
        data: {
          intent_id: intent.id,
          wish_dates: wishDates,
          wish_period: period as "morning" | "afternoon" | "any",
          consulate,
          notes,
        },
      });
    },
    onSuccess: () => { invalidate(); toast.success("Preferência salva"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: async (date: string) => {
      await confirmFn({ data: { intent_id: intent.id, confirmed_date: date, consulate } });
    },
    onSuccess: () => { invalidate(); toast.success("Data confirmada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopenMut = useMutation({
    mutationFn: async () => { await reopenFn({ data: { intent_id: intent.id } }); },
    onSuccess: () => { invalidate(); toast.success("Reaberto"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isConfirmed && variant === "portal") {
    const d = new Date(intent.confirmed_date! + "T12:00:00");
    const formatted = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    return (
      <div className="rounded-2xl border-2 border-vgreen/40 bg-vgreen/5 p-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-vgreen font-bold">{SERVICE_LABEL[intent.service]}</p>
          <CalendarCheck size={18} className="text-vgreen" />
        </div>
        <p className="mt-2 text-xl font-display font-extrabold text-navy capitalize">{formatted}</p>
        {intent.consulate && (
          <p className="mt-1 text-sm text-ink-soft">
            Consulado: <b>{CONSULATE_LABEL[intent.consulate as keyof typeof CONSULATE_LABEL] ?? intent.consulate}</b>
          </p>
        )}
        <a
          href={googleCalUrl({
            title: `${SERVICE_LABEL[intent.service]} — Viajaly`,
            date: intent.confirmed_date!,
            details: `Agendamento ${SERVICE_LABEL[intent.service]} para ${travelerName}`,
            location: intent.consulate ? CONSULATE_LABEL[intent.consulate as keyof typeof CONSULATE_LABEL] ?? "" : "",
          })}
          target="_blank"
          rel="noopener"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-coral underline underline-offset-4"
        >
          Adicionar ao Google Calendar <ExternalLink size={12} />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">{SERVICE_LABEL[intent.service]}</p>
          {optional && <span className="text-[10px] text-amber-700 font-semibold">Opcional</span>}
        </div>
        <StatusPill status={intent.status} />
      </div>

      {variant === "console" && isConfirmed && (
        <div className="mt-3 text-sm text-navy">
          Confirmado em <b>{new Date(intent.confirmed_date! + "T12:00:00").toLocaleDateString("pt-BR")}</b>
          {intent.consulate && <> · {intent.consulate}</>}
          <Button size="sm" variant="ghost" className="ml-2 text-coral" onClick={() => reopenMut.mutate()}>
            <RotateCcw size={12} className="mr-1" /> Reabrir
          </Button>
        </div>
      )}

      {!isConfirmed && (
        <>
          {variant === "portal" && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Consulado</label>
                  <Select value={consulate} onValueChange={setConsulate}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONSULATES.map((c) => <SelectItem key={c} value={c}>{CONSULATE_LABEL[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Período</label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Manhã</SelectItem>
                      <SelectItem value="afternoon">Tarde</SelectItem>
                      <SelectItem value="any">Qualquer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DatePicker
                available={availableDates}
                selected={wishDates}
                onChange={setWishDates}
                max={3}
              />

              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações (opcional)"
                rows={2}
                maxLength={500}
                className="mt-3 text-sm"
              />

              <Button
                size="sm"
                className="mt-3 rounded-full bg-coral hover:bg-[var(--color-coral-hover)] text-cream"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
              >
                <Send size={14} className="mr-1.5" /> Enviar preferência
              </Button>
            </>
          )}

          {variant === "console" && (
            <>
              <div className="mt-3 text-sm space-y-1">
                <p className="text-ink-soft">Consulado pedido: <b>{intent.consulate ?? "—"}</b></p>
                <p className="text-ink-soft">Período: <b>{intent.wish_period ? PERIOD_LABEL[intent.wish_period] ?? intent.wish_period : "—"}</b></p>
                <p className="text-ink-soft">
                  Datas: {intent.wish_dates && intent.wish_dates.length > 0
                    ? intent.wish_dates.map((d) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR")).join(", ")
                    : "—"}
                </p>
                {intent.notes && <p className="text-ink-soft italic">"{intent.notes}"</p>}
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Confirmar data</label>
                  <Input
                    type="date"
                    value={confirmDate}
                    onChange={(e) => setConfirmDate(e.target.value)}
                    className="mt-1 w-48"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Consulado</label>
                  <Select value={consulate} onValueChange={setConsulate}>
                    <SelectTrigger className="mt-1 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONSULATES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  className="bg-vgreen hover:bg-vgreen/90 text-white"
                  onClick={() => confirmDate ? confirmMut.mutate(confirmDate) : toast.error("Escolha a data")}
                  disabled={confirmMut.isPending}
                >
                  <CalendarCheck size={14} className="mr-1.5" /> Confirmar
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Intent["status"] }) {
  const map = {
    open: { label: "Aguardando preferência", cls: "bg-[var(--color-muted)] text-ink-soft", Icon: Clock },
    sent: { label: "Preferência enviada", cls: "bg-amber-100 text-amber-700", Icon: Send },
    confirmed: { label: "Confirmado", cls: "bg-vgreen/15 text-vgreen", Icon: CalendarCheck },
  } as const;
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${m.cls}`}>
      <m.Icon size={12} /> {m.label}
    </span>
  );
}

function DatePicker({
  available,
  selected,
  onChange,
  max,
}: {
  available: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  max: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const future = available.filter((d) => d >= today).sort();

  if (future.length === 0) {
    return (
      <div className="mt-3 rounded-xl bg-[var(--color-muted)] p-3 text-xs text-ink-soft">
        Aguardando a Viajaly liberar as datas — você será notificado.
      </div>
    );
  }

  function toggle(d: string) {
    if (selected.includes(d)) onChange(selected.filter((x) => x !== d));
    else if (selected.length < max) onChange([...selected, d]);
    else toast.info(`Você pode escolher até ${max} datas`);
  }

  return (
    <div className="mt-3">
      <label className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">
        Datas que funcionam (até {max})
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {future.map((d) => {
          const on = selected.includes(d);
          const label = new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                on
                  ? "bg-coral text-cream border-coral"
                  : "bg-white text-navy border-[var(--color-border)] hover:border-coral"
              }`}
            >
              {on ? <X size={10} className="inline mr-1" /> : <Plus size={10} className="inline mr-1" />}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
