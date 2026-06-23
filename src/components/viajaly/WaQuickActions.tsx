import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { waLink, waTemplates } from "@/lib/whatsapp";

/**
 * Atalhos de aviso por WhatsApp (wa.me) — abrem o app com mensagem pronta.
 * Sem custo de API; o admin clica e o WhatsApp encarrega-se do envio.
 */
export function WaQuickActions({
  phone,
  clientName,
}: {
  phone: string | null | undefined;
  clientName: string;
}) {
  const items: Array<{ label: string; msg: string }> = [
    { label: "Proposta aceita", msg: waTemplates.proposalAccepted(clientName) },
    { label: "Pagamento confirmado", msg: waTemplates.paymentConfirmed(clientName) },
    { label: "Documento aprovado", msg: waTemplates.documentApproved(clientName, "(nome do documento)") },
    { label: "Documento reprovado", msg: waTemplates.documentRejected(clientName, "(nome do documento)") },
    {
      label: "Agendamento confirmado",
      msg: waTemplates.scheduleConfirmed(clientName, new Date().toISOString()),
    },
  ];

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((it) => (
        <a
          key={it.label}
          href={waLink(phone ?? "", it.msg)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral rounded-md"
        >
          <Button variant="outline" size="sm" className="gap-1.5 min-h-10">
            <MessageCircle size={14} /> {it.label}
          </Button>
        </a>
      ))}
    </div>
  );
}
