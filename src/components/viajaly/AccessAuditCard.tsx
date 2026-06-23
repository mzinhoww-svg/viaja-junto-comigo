import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { regenerateAccessCode } from "@/lib/access.functions";
import { Button } from "@/components/ui/button";
import { Check, Copy, RotateCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

type Attempt = {
  id: string;
  at: string;
  ip: string | null;
  success: boolean;
  attempted_code: string | null;
};

function maskCode(c: string | null) {
  if (!c) return "••••••";
  if (c.length < 2) return "••••••";
  return "••••" + c.slice(-2);
}

export function AccessAuditCard({ requestId }: { requestId: string }) {
  const qc = useQueryClient();
  const regen = useServerFn(regenerateAccessCode);
  const [copied, setCopied] = useState(false);

  const reqQ = useQuery({
    queryKey: ["request-access", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("access_code, access_code_expires_at, lead_email")
        .eq("id", requestId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const attemptsQ = useQuery({
    queryKey: ["access-attempts", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_code_attempts")
        .select("id, at, ip, success, attempted_code")
        .eq("request_id", requestId)
        .order("at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as Attempt[];
    },
  });

  const regenMut = useMutation({
    mutationFn: async () => regen({ data: { request_id: requestId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request-access", requestId] });
      qc.invalidateQueries({ queryKey: ["request", requestId] });
      toast.success("Novo código gerado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const expiresAt = reqQ.data?.access_code_expires_at ? new Date(reqQ.data.access_code_expires_at) : null;
  const expired = expiresAt ? expiresAt < new Date() : false;
  const code = reqQ.data?.access_code ?? "------";

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-navy">Acesso do cliente</h2>
        <Button size="sm" variant="outline" disabled={regenMut.isPending} onClick={() => {
          if (confirm("Gerar novo código? O atual deixará de funcionar.")) regenMut.mutate();
        }}>
          <RotateCw size={14} className={`mr-1.5 ${regenMut.isPending ? "animate-spin" : ""}`} />
          Gerar novo código
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 bg-[var(--color-muted)] rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Código atual</p>
          <p className="font-mono text-2xl font-bold text-navy tracking-widest mt-0.5">{code}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </Button>
      </div>

      {expiresAt && (
        <p className={`mt-3 text-xs ${expired ? "text-coral" : "text-ink-soft"}`}>
          {expired ? "⚠ Expirado em " : "Expira em "}
          {expiresAt.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}

      <div className="mt-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-2">
          Tentativas recentes
        </h3>
        {attemptsQ.isLoading ? (
          <p className="text-xs text-ink-muted">Carregando…</p>
        ) : attemptsQ.data && attemptsQ.data.length > 0 ? (
          <ul className="space-y-1.5">
            {attemptsQ.data.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {a.success ? (
                    <ShieldCheck size={14} className="text-vgreen shrink-0" />
                  ) : (
                    <ShieldAlert size={14} className="text-coral shrink-0" />
                  )}
                  <span className="text-ink-soft">
                    {new Date(a.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className="font-mono text-ink-muted">{maskCode(a.attempted_code)}</span>
                </div>
                <span className="text-ink-muted truncate max-w-[140px]">{a.ip ?? "—"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-muted">Nenhuma tentativa registrada.</p>
        )}
      </div>
    </div>
  );
}
