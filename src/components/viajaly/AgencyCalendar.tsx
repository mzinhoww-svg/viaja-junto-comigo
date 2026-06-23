import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SERVICE_SHORT, SERVICE_COLOR, type Service } from "@/lib/schedule-shared";

type Row = {
  id: string;
  service: Service;
  status: string;
  confirmed_date: string | null;
  consulate: string | null;
  traveler: { name: string; request_id: string; request: { lead_name: string } } | null;
};

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function daysIn(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }

export function AgencyCalendar() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const start = `${monthKey(cursor)}-01`;
  const end = `${monthKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}-01`;

  const q = useQuery({
    queryKey: ["agenda-overview", start],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_intents")
        .select("id, service, status, confirmed_date, consulate, traveler:travelers(name, request_id, request:requests(lead_name))")
        .eq("status", "confirmed")
        .gte("confirmed_date", start)
        .lt("confirmed_date", end)
        .order("confirmed_date");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  if (q.isLoading) return <Skeleton className="h-96 rounded-2xl" />;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const total = daysIn(year, month);
  const firstWeekday = new Date(year, month, 1).getDay();
  const byDate = new Map<string, Row[]>();
  for (const r of q.data ?? []) {
    if (!r.confirmed_date) continue;
    const list = byDate.get(r.confirmed_date) ?? [];
    list.push(r);
    byDate.set(r.confirmed_date, list);
  }

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-navy capitalize">{monthLabel}</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft size={14} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-ink-muted font-bold">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => <div key={d} className="text-center py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 mt-1">
        {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: total }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const items = byDate.get(dateStr) ?? [];
          return (
            <div key={day} className={`min-h-[72px] rounded-lg border p-1.5 ${items.length ? "border-coral/40 bg-coral/5" : "border-[var(--color-border)] bg-white"}`}>
              <p className="text-[10px] text-ink-muted font-semibold">{day}</p>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((r) => (
                  <Link
                    key={r.id}
                    to="/console/cliente/$id"
                    params={{ id: r.traveler?.request_id ?? "" }}
                    className={`block text-[10px] font-bold px-1.5 py-0.5 rounded ${SERVICE_COLOR[r.service]} truncate`}
                    title={`${SERVICE_SHORT[r.service]} · ${r.traveler?.request?.lead_name ?? ""}`}
                  >
                    {SERVICE_SHORT[r.service]} · {r.traveler?.request?.lead_name?.split(" ")[0] ?? ""}
                  </Link>
                ))}
                {items.length > 3 && <p className="text-[10px] text-ink-muted">+{items.length - 3}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PendingIntents() {
  const q = useQuery({
    queryKey: ["agenda-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_intents")
        .select("id, service, status, wish_dates, consulate, traveler:travelers(name, request_id, request:requests(lead_name))")
        .eq("status", "sent")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Array<Row & { wish_dates: string[] | null }>;
    },
  });

  if (q.isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  const rows = q.data ?? [];

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
      <h3 className="font-display font-bold text-navy">Aguardando confirmação ({rows.length})</h3>
      {rows.length === 0 && <p className="mt-3 text-sm text-ink-muted">Nada pendente.</p>}
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              to="/console/cliente/$id"
              params={{ id: r.traveler?.request_id ?? "" }}
              className="block rounded-lg border border-[var(--color-border)] p-3 hover:border-coral transition"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-navy">{r.traveler?.request?.lead_name}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${SERVICE_COLOR[r.service]}`}>{SERVICE_SHORT[r.service]}</span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                {r.traveler?.name} · {r.consulate ?? "—"}
                {r.wish_dates && r.wish_dates.length > 0 && <> · pediu {r.wish_dates.map((d) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })).join(", ")}</>}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
