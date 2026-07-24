import { jsPDF } from "jspdf";
import { SLOT_PERIODS, type ItineraryDay, type SlotPeriod } from "@/lib/itinerary";

export type ItineraryPdfTrip = {
  nome: string;
  destinoPais: string;
  destinoCidade: string | null;
  dataViagem: string | null;
  numPessoas: number;
};

const PERIOD_LABELS: Record<SlotPeriod, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

const EMPTY_PLACEHOLDER = "—";

export type ItinerarySummary = {
  destino: string;
  periodo: string;
  totalDiasLabel: string;
  viajantesLabel: string;
};

export function buildItinerarySummary(
  trip: ItineraryPdfTrip,
  days: ItineraryDay[],
): ItinerarySummary {
  const destino = trip.destinoCidade
    ? `${trip.destinoCidade}, ${trip.destinoPais}`
    : trip.destinoPais;
  const periodo = trip.dataViagem
    ? new Date(`${trip.dataViagem}T00:00:00`).toLocaleDateString("pt-BR")
    : "Data ainda não definida";
  const totalDiasLabel = days.length === 1 ? "1 dia de roteiro" : `${days.length} dias de roteiro`;
  const viajantesLabel = trip.numPessoas === 1 ? "1 pessoa" : `${trip.numPessoas} pessoas`;
  return { destino, periodo, totalDiasLabel, viajantesLabel };
}

export function buildDayHeading(day: ItineraryDay): string {
  if (!day.data) return `Dia ${day.diaNumero}`;
  const formatted = new Date(`${day.data}T00:00:00`).toLocaleDateString("pt-BR");
  return `Dia ${day.diaNumero} — ${formatted}`;
}

export type DaySlotLine = {
  label: string;
  ondeIr: string;
  ondeComer: string;
  observacoes: string;
};

export function buildDaySlotLines(day: ItineraryDay): DaySlotLine[] {
  return SLOT_PERIODS.map((periodo) => {
    const slot = day.slots.find((s) => s.periodo === periodo);
    return {
      label: PERIOD_LABELS[periodo],
      ondeIr: slot?.ondeIr || EMPTY_PLACEHOLDER,
      ondeComer: slot?.ondeComer || EMPTY_PLACEHOLDER,
      observacoes: slot?.observacoes || EMPTY_PLACEHOLDER,
    };
  });
}

export function itineraryPdfFileName(nomeTrip: string): string {
  const slug = nomeTrip
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `roteiro-${slug || "viagem"}.pdf`;
}

const NAVY: [number, number, number] = [11, 35, 79];
const CORAL: [number, number, number] = [255, 90, 95];
const GRAY: [number, number, number] = [120, 120, 120];
const INK: [number, number, number] = [40, 40, 40];

const PAGE_BOTTOM_MARGIN = 760;

function addPageIfNeeded(doc: jsPDF, y: number, threshold = PAGE_BOTTOM_MARGIN): number {
  if (y <= threshold) return y;
  doc.addPage();
  return 50;
}

/** Monta o documento em memória, sem salvar — usado pelo export real e testável via `.output()`. */
export function buildItineraryPdfDocument(trip: ItineraryPdfTrip, days: ItineraryDay[]): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const summary = buildItinerarySummary(trip, days);
  let y = 60;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text("Roteiro de viagem", 50, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text("Viajaly Trip", 50, y + 12);
  doc.setDrawColor(...CORAL);
  doc.line(50, y + 22, W - 50, y + 22);
  y += 44;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(trip.nome, 50, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(`Destino: ${summary.destino}`, 50, y);
  y += 16;
  doc.text(`Data: ${summary.periodo}`, 50, y);
  y += 16;
  doc.text(`Viajantes: ${summary.viajantesLabel}`, 50, y);
  y += 16;
  doc.text(summary.totalDiasLabel, 50, y);
  y += 32;

  if (days.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...GRAY);
    doc.text("Nenhum dia adicionado ao roteiro ainda.", 50, y);
  } else {
    for (const day of days) {
      y = addPageIfNeeded(doc, y, 700);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...NAVY);
      doc.text(buildDayHeading(day), 50, y);
      y += 20;

      for (const line of buildDaySlotLines(day)) {
        y = addPageIfNeeded(doc, y, 740);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        doc.text(line.label, 50, y);

        doc.setFont("helvetica", "normal");
        doc.text(`Onde ir: ${line.ondeIr}`, 110, y);
        y += 13;
        doc.text(`Onde comer: ${line.ondeComer}`, 110, y);
        y += 13;
        doc.text(`Obs.: ${line.observacoes}`, 110, y);
        y += 19;
      }
      y += 8;
    }
  }

  return doc;
}

export function exportItineraryPdf(trip: ItineraryPdfTrip, days: ItineraryDay[]): void {
  const doc = buildItineraryPdfDocument(trip, days);
  doc.save(itineraryPdfFileName(trip.nome));
}
