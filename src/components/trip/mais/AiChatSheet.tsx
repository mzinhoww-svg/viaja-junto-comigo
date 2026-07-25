import { Bot, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAiChat } from "@/hooks/useAiChat";
import { useAiUsage } from "@/hooks/useAiUsage";
import { useEntitlement } from "@/hooks/useEntitlement";
import { usePaywall } from "@/hooks/usePaywall";
import { aiMsgLimit, isAiQuotaExhausted } from "@/lib/entitlements";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  whatsappUrl?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  ai_disabled: "O assistente está temporariamente indisponível.",
  ai_daily_cap_reached: "O assistente atingiu o limite de uso do dia. Tente novamente mais tarde.",
  ai_upstream_error: "Não foi possível gerar uma resposta agora. Tente novamente.",
  trip_not_found: "Não encontramos sua viagem. Recarregue a página e tente de novo.",
};

/**
 * Chat do assistente IA (VJT-014) — aberto a partir do "Perguntar" em
 * `AiAssistantCard` (VJT-011). Sem histórico persistido entre aberturas
 * (cada abertura começa uma tela em branco; a Edge Function mantém a
 * conversa e o contexto no servidor via `conversation_id`).
 */
export function AiChatSheet({
  tripId,
  open,
  onOpenChange,
}: {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const entitlement = useEntitlement();
  const usage = useAiUsage();
  const { openPaywall } = usePaywall();
  const chat = useAiChat(tripId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  const used = usage.data ?? 0;
  const limit = aiMsgLimit(entitlement.tier);
  const exhausted = isAiQuotaExhausted(entitlement.tier, used);

  function handleSend() {
    const text = draft.trim();
    if (!text || chat.isPending) return;
    if (exhausted) {
      onOpenChange(false);
      openPaywall("cota_ia");
      return;
    }

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
    setDraft("");

    chat.mutate(text, {
      onSuccess: (data) => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.message,
            whatsappUrl: data.redirect?.whatsapp_url,
          },
        ]);
      },
      onError: (error) => {
        const code = error instanceof Error ? error.message : "ai_error";
        if (code === "quota_exhausted") {
          onOpenChange(false);
          openPaywall("cota_ia");
          return;
        }
        toast.error(
          ERROR_MESSAGES[code] ?? "Não foi possível enviar sua mensagem. Tente novamente.",
        );
      },
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[85vh] flex-col gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" aria-hidden />
            Assistente IA
          </SheetTitle>
          <SheetDescription>
            {used}/{limit} mensagens este mês — pergunte sobre o planejamento desta viagem.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="flex flex-col gap-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Pergunte sobre roteiro, checklist, orçamento ou dicas para a sua viagem.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
                }
              >
                {m.content}
                {m.whatsappUrl && (
                  <a
                    href={m.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block font-medium underline"
                  >
                    Falar no WhatsApp
                  </a>
                )}
              </div>
            ))}
            {chat.isPending && (
              <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Pensando...
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex items-center gap-2 border-t p-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Pergunte sobre sua viagem..."
            disabled={chat.isPending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={chat.isPending || !draft.trim()}
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
