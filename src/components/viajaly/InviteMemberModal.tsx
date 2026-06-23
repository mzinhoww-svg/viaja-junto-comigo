import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { X, Copy, Check } from "lucide-react";

export function InviteMemberModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"consultor" | "admin">("consultor");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("invite_member" as never, {
        _email: email,
        _role: role,
      } as never);
      if (error) throw error;
      return data as unknown as { token: string };
    },
    onSuccess: (d) => {
      const url = `${window.location.origin}/console/aceitar-convite?token=${d.token}`;
      setLink(url);
      qc.invalidateQueries({ queryKey: ["agency-invites"] });
      toast.success("Convite criado — copie o link abaixo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="font-display font-bold text-navy">Convidar pessoa</h3>
          <button onClick={onClose} className="text-ink-soft hover:text-coral"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {!link ? (
            <>
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">E-mail</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@agencia.com" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Papel</label>
                <select value={role} onChange={(e) => setRole(e.target.value as "consultor" | "admin")} className="w-full border border-[var(--color-border)] rounded-md px-3 h-10 text-sm bg-white">
                  <option value="consultor">Consultor (operação)</option>
                  <option value="admin">Admin (tudo)</option>
                </select>
                <p className="text-[11px] text-ink-muted mt-1">
                  A pessoa precisa criar conta com este e-mail e abrir o link de convite.
                </p>
              </div>
              <Button onClick={() => invite.mutate()} disabled={invite.isPending || !email} className="w-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream">
                {invite.isPending ? "Criando…" : "Criar convite"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink">Envie este link para a pessoa convidada:</p>
              <div className="flex gap-2">
                <Input readOnly value={link} className="font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={copy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
              <p className="text-[11px] text-ink-muted">Válido por 7 dias. Só pode ser usado pelo e-mail convidado.</p>
              <Button onClick={onClose} className="w-full bg-navy hover:bg-[var(--color-navy-light)] text-cream">Fechar</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
