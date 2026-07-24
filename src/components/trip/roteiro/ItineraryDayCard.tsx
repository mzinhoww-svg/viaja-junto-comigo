import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Sun, Sunset, Moon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ItineraryDay, ItinerarySlot, SlotPeriod } from "@/lib/itinerary";
import { cn } from "@/lib/utils";

const PERIOD_META: Record<SlotPeriod, { label: string; icon: typeof Sun }> = {
  manha: { label: "Manhã", icon: Sun },
  tarde: { label: "Tarde", icon: Sunset },
  noite: { label: "Noite", icon: Moon },
};

type SlotField = "ondeIr" | "ondeComer" | "observacoes";

type Props = {
  day: ItineraryDay;
  isFirst: boolean;
  isLast: boolean;
  collapsed: boolean;
  onToggleCollapsed: (dayId: string) => void;
  onMove: (dayId: string, direction: "up" | "down") => void;
  onDuplicate: (dayId: string) => void;
  onRemove: (dayId: string) => void;
  onSlotFieldChange: (slotId: string, field: SlotField, value: string) => void;
};

export function ItineraryDayCard({
  day,
  isFirst,
  isLast,
  collapsed,
  onToggleCollapsed,
  onMove,
  onDuplicate,
  onRemove,
  onSlotFieldChange,
}: Props) {
  return (
    <Collapsible
      open={!collapsed}
      onOpenChange={() => onToggleCollapsed(day.id)}
      className="rounded-xl border border-border bg-card"
    >
      <div className="flex items-center gap-2 p-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex flex-1 items-center gap-2 text-left"
            aria-label={
              collapsed ? `Expandir dia ${day.diaNumero}` : `Colapsar dia ${day.diaNumero}`
            }
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="font-semibold text-foreground">Dia {day.diaNumero}</span>
          </button>
        </CollapsibleTrigger>

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isFirst}
            aria-label={`Mover dia ${day.diaNumero} para cima`}
            onClick={() => onMove(day.id, "up")}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isLast}
            aria-label={`Mover dia ${day.diaNumero} para baixo`}
            onClick={() => onMove(day.id, "down")}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Duplicar dia ${day.diaNumero}`}
            onClick={() => onDuplicate(day.id)}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                aria-label={`Remover dia ${day.diaNumero}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover Dia {day.diaNumero}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Os planos de manhã, tarde e noite deste dia serão apagados. Os dias seguintes são
                  renumerados automaticamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onRemove(day.id)}>Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <CollapsibleContent className="space-y-3 border-t border-border p-3">
        {day.slots.map((slot) => (
          <SlotBlock key={slot.id} slot={slot} onFieldChange={onSlotFieldChange} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SlotBlock({
  slot,
  onFieldChange,
}: {
  slot: ItinerarySlot;
  onFieldChange: (slotId: string, field: SlotField, value: string) => void;
}) {
  const meta = PERIOD_META[slot.periodo];
  const Icon = meta.icon;
  const [ondeIr, setOndeIr] = useState(slot.ondeIr ?? "");
  const [ondeComer, setOndeComer] = useState(slot.ondeComer ?? "");
  const [observacoes, setObservacoes] = useState(slot.observacoes ?? "");

  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {meta.label}
      </div>
      <div className="space-y-2">
        <Input
          value={ondeIr}
          placeholder="Onde ir"
          aria-label={`${meta.label} — onde ir`}
          onChange={(e) => setOndeIr(e.target.value)}
          onBlur={() => {
            if (ondeIr !== (slot.ondeIr ?? "")) onFieldChange(slot.id, "ondeIr", ondeIr);
          }}
        />
        <Input
          value={ondeComer}
          placeholder="Onde comer"
          aria-label={`${meta.label} — onde comer`}
          onChange={(e) => setOndeComer(e.target.value)}
          onBlur={() => {
            if (ondeComer !== (slot.ondeComer ?? ""))
              onFieldChange(slot.id, "ondeComer", ondeComer);
          }}
        />
        <Textarea
          value={observacoes}
          placeholder="Observações"
          rows={2}
          aria-label={`${meta.label} — observações`}
          className={cn("text-sm")}
          onChange={(e) => setObservacoes(e.target.value)}
          onBlur={() => {
            if (observacoes !== (slot.observacoes ?? ""))
              onFieldChange(slot.id, "observacoes", observacoes);
          }}
        />
      </div>
    </div>
  );
}
