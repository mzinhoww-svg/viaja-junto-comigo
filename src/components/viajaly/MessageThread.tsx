import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, Lock, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { TemplatesPicker } from "@/components/viajaly/TemplatesPicker";

type Attachment = { name: string; path: string };

type Msg = {
  id: string;
  request_id: string;
  from: "client" | "consultant";
  text: string;
  attachments: Attachment[] | null;
  internal: boolean;
  read_at: string | null;
  created_at: string;
};

function useMessages(requestId: string, isAdmin: boolean) {
  return useQuery({
    queryKey: ["messages", requestId],
    queryFn: async () => {
      let q = supabase
        .from("messages")
        .select("id, request_id, from, text, attachments, internal, read_at, created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (!isAdmin) q = q.eq("internal", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Msg[];
    },
  });
}

export function MessageThread({ requestId, isAdmin }: { requestId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const q = useMessages(requestId, isAdmin);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ch = supabase
      .channel(`messages:${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `request_id=eq.${requestId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", requestId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, requestId]);

  useEffect(() => {
    (async () => {
      try { await supabase.rpc("mark_messages_read" as never, { _request_id: requestId } as never); } catch { /* noop */ }
    })();
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [q.data?.length, requestId]);

  const send = useMutation({
    mutationFn: async () => {
      const t = body.trim();
      if (!t && files.length === 0) throw new Error("Mensagem vazia");
      const { error } = await supabase.rpc("send_message" as never, {
        _request_id: requestId,
        _body: t,
        _attachments: files,
        _internal: isAdmin && internal,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { setBody(""); setFiles([]); qc.invalidateQueries({ queryKey: ["messages", requestId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const path = `chat/${requestId}/${crypto.randomUUID()}/${f.name}`;
      const up = await supabase.storage.from("documents").upload(path, f);
      if (up.error) throw up.error;
      setFiles((s) => [...s, { name: f.name, path }]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function openAttachment(path: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 5);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const mineFrom: "client" | "consultant" = isAdmin ? "consultant" : "client";

  return (
    <div className="flex flex-col h-full min-h-[400px] bg-white border border-[var(--color-border)] rounded-2xl">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {(q.data ?? []).length === 0 && (
          <p className="text-center text-xs text-ink-soft py-8">Comece a conversa abaixo.</p>
        )}
        {(q.data ?? []).map((m) => {
          const mine = m.from === mineFrom;
          const align = mine ? "items-end" : "items-start";
          const bubble = m.internal
            ? "bg-amber-100 text-amber-900 border border-amber-200"
            : mine ? "bg-coral text-cream" : "bg-slate-100 text-ink";
          return (
            <div key={m.id} className={`flex flex-col ${align}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${bubble}`}>
                {m.internal && (
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold mb-1 opacity-80">
                    <Lock size={10} /> Nota interna
                  </div>
                )}
                {m.text && <p className="whitespace-pre-line">{m.text}</p>}
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {m.attachments.map((a, i) => (
                      <button key={i} onClick={() => openAttachment(a.path)} className="flex items-center gap-1 text-xs underline opacity-90 hover:opacity-100">
                        <Paperclip size={11} /> {a.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-ink-muted mt-0.5 px-1">
                {new Date(m.created_at).toLocaleString("pt-BR")}
                {mine && m.read_at && " · lida"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[var(--color-border)] p-3 space-y-2">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {files.map((f, i) => (
              <span key={i} className="text-[11px] bg-slate-100 px-2 py-1 rounded-full">
                {f.name}
                <button onClick={() => setFiles((s) => s.filter((_, j) => j !== i))} className="ml-1 text-ink-muted hover:text-coral">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea value={body} onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send.mutate(); }}
            placeholder="Escreva uma mensagem… (Ctrl+Enter envia)" rows={2}
            className="flex-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm resize-none" />
          <div className="flex flex-col gap-1">
            <label className="cursor-pointer p-2 rounded-lg border border-[var(--color-border)] hover:border-coral text-ink-soft" title="Anexar">
              <Paperclip size={16} />
              <input type="file" hidden onChange={onFile} disabled={uploading} />
            </label>
            <Button size="sm" className="bg-coral hover:bg-coral-dark text-cream" onClick={() => send.mutate()} disabled={send.isPending}>
              <Send size={14} />
            </Button>
          </div>
        </div>
        {isAdmin && (
          <label className="inline-flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            <Lock size={12} /> Enviar como nota interna (cliente não vê)
          </label>
        )}
      </div>
    </div>
  );
}
