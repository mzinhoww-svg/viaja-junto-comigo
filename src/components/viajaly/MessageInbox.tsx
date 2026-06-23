import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";

type Conv = {
  request_id: string;
  lead_name: string;
  last_text: string | null;
  last_at: string;
  unread: number;
};

export function MessageInbox() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["message-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("request_id, text, created_at, read_at, internal, from, requests:request_id(lead_name)")
        .eq("internal", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const rows = (data ?? []) as unknown as Array<{
        request_id: string; text: string | null; created_at: string; read_at: string | null;
        from: "client" | "consultant"; requests: { lead_name: string } | null;
      }>;

      const map = new Map<string, Conv>();
      for (const m of rows) {
        const cur = map.get(m.request_id);
        const isInbound = m.from === "client";
        const unreadInc = isInbound && !m.read_at ? 1 : 0;
        if (!cur) {
          map.set(m.request_id, {
            request_id: m.request_id,
            lead_name: m.requests?.lead_name ?? "—",
            last_text: m.text,
            last_at: m.created_at,
            unread: unreadInc,
          });
        } else {
          cur.unread += unreadInc;
        }
      }
      return Array.from(map.values());
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("inbox-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" },
        () => qc.invalidateQueries({ queryKey: ["message-inbox"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const convs = q.data ?? [];

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={16} className="text-coral" />
        <h2 className="font-display font-bold text-navy text-sm">Mensagens recentes</h2>
      </div>
      {convs.length === 0 && <p className="text-xs text-ink-soft">Nenhuma conversa ativa.</p>}
      <div className="space-y-1">
        {convs.slice(0, 8).map((c) => (
          <Link key={c.request_id} to="/console/cliente/$id" params={{ id: c.request_id }}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-[var(--color-muted)]">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy truncate">{c.lead_name}</p>
              <p className="text-xs text-ink-soft truncate">{c.last_text ?? "—"}</p>
            </div>
            {c.unread > 0 && (
              <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-coral text-cream text-[10px] font-bold flex items-center justify-center">
                {c.unread > 9 ? "9+" : c.unread}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
