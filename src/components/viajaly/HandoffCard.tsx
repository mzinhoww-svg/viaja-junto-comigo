import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { personalizedAccessLink, buildHandoffMessage, openWhatsApp } from "@/lib/whatsapp";

interface HandoffCardProps {
  clientName: string;
  accessCode: string;
  phone?: string | null;
  /** Texto opcional acima do card */
  title?: string;
  subtitle?: string;
}

/**
 * Card de "share" do acesso do cliente — inspirado no padrão Claude/ChatGPT
 * de link compartilhável: link em destaque, código grande copiável e ações
 * rápidas (WhatsApp, copiar mensagem, abrir o portal numa nova aba).
 *
 * Use-o no fim da criação/edição de orçamento e na ficha do cliente.
 */
export function HandoffCard({
  clientName,
  accessCode,
  phone,
  title = "Acesso do cliente",
  subtitle,
}: HandoffCardProps) {
  const [link, setLink] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const l = personalizedAccessLink(accessCode);
    setLink(l);
    QRCode.toDataURL(l, { margin: 1, width: 220, color: { dark: "#0B1F3A", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [accessCode]);

  const message = buildHandoffMessage({ name: clientName, link, code: accessCode });

  async function copy(text: string, kind: "link" | "code" | "msg") {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "link") { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 1500); }
      else if (kind === "code") { setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500); }
      else toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-white to-[var(--color-muted)] p-5 md:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-coral">{title}</p>
          <h3 className="mt-1 font-display font-extrabold text-navy text-xl">
            {clientName.split(" ")[0]} já pode entrar
          </h3>
          {subtitle && <p className="text-sm text-ink-soft mt-1">{subtitle}</p>}
        </div>
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="QR Code para acessar o portal"
            className="hidden sm:block w-24 h-24 rounded-xl border border-[var(--color-border)] bg-white"
          />
        )}
      </div>

      {/* Link personalizado */}
      <div className="rounded-2xl bg-navy text-cream p-4 shadow-inner">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest font-bold text-cream/60">
            Link personalizado
          </span>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cream/70 hover:text-cream"
            aria-label="Abrir em nova aba"
          >
            <ExternalLink size={14} />
          </a>
        </div>
        <p className="font-mono text-xs sm:text-sm break-all leading-relaxed">
          {link || "—"}
        </p>
        <Button
          onClick={() => copy(link, "link")}
          variant="outline"
          size="sm"
          className="mt-3 w-full bg-cream/5 border-cream/20 text-cream hover:bg-cream/10 hover:text-cream rounded-full"
        >
          {copiedLink ? <><Check size={14} className="mr-1.5" /> Link copiado</> : <><Copy size={14} className="mr-1.5" /> Copiar link</>}
        </Button>
      </div>

      {/* Código grande */}
      <div className="mt-3 rounded-2xl bg-white border border-[var(--color-border)] p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">
            Código (caso precise digitar)
          </div>
          <div className="font-mono text-3xl font-extrabold text-navy tracking-[0.35em] mt-1">
            {accessCode}
          </div>
        </div>
        <Button onClick={() => copy(accessCode, "code")} size="icon" variant="outline" aria-label="Copiar código">
          {copiedCode ? <Check size={16} /> : <Copy size={16} />}
        </Button>
      </div>

      <p className="mt-4 text-xs text-ink-soft leading-relaxed">
        💡 Sempre que falar com {clientName.split(" ")[0]}, reenvie este link — o código vai
        preenchido automaticamente e o acesso fica em 1 toque.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => openWhatsApp(phone, message)}
          className="flex-1 sm:flex-none bg-[#25D366] hover:bg-[#1ebe5b] text-white rounded-full"
        >
          <MessageCircle size={16} className="mr-1.5" /> Enviar pelo WhatsApp
        </Button>
        <Button
          variant="outline"
          onClick={() => copy(message, "msg")}
          className="flex-1 sm:flex-none rounded-full"
        >
          <Copy size={16} className="mr-1.5" /> Copiar mensagem
        </Button>
      </div>
    </div>
  );
}
