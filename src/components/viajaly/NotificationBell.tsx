import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["my-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, created_at, read_at")
        .eq("audience", "client")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("notifications-client")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" },
        () => qc.invalidateQueries({ queryKey: ["my-notifications"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("mark_notification_read", { _notification_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  const unread = (q.data ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="text-ink-muted hover:text-coral p-2 relative" aria-label="Notificações">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-coral text-cream text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-80 max-h-[420px] overflow-y-auto bg-white border border-[var(--color-border)] rounded-2xl shadow-lg z-40">
            <div className="p-3 border-b border-[var(--color-border)] font-display font-bold text-navy text-sm">Notificações</div>
            {(q.data ?? []).length === 0 && <p className="p-4 text-xs text-ink-soft">Sem novidades por enquanto.</p>}
            {(q.data ?? []).map((n) => (
              <button key={n.id}
                onClick={() => { if (!n.read_at) markRead.mutate(n.id); }}
                className={`w-full text-left p-3 border-b last:border-b-0 border-[var(--color-border)] hover:bg-[var(--color-muted)] ${n.read_at ? "opacity-60" : ""}`}>
                <p className="text-sm font-semibold text-navy">{n.title}</p>
                {n.body && <p className="text-xs text-ink-soft mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-ink-muted mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
