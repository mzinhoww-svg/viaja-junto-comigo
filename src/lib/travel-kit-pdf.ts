import { jsPDF } from "jspdf";

type KitData = {
  clientName: string;
  accessCode: string;
  outcome: string | null;
  decisionAt: string | null;
  validityUntil: string | null;
  checklist: Record<string, boolean>;
  emergencyContacts: Array<{ label: string; value: string }>;
  agencyName: string;
};

const CHECKLIST_LABELS: Record<string, string> = {
  passaporte: "Passaporte (validade 6+ meses)",
  passagem: "Passagem aérea",
  hospedagem: "Comprovante de hospedagem",
  seguro_viagem: "Seguro viagem",
  comprovante_financeiro: "Comprovante financeiro",
  vacina: "Comprovante de vacina (se aplicável)",
  itinerario: "Itinerário de viagem",
  copia_visto: "Cópia do visto",
};

export function generateTravelKitPDF(d: KitData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 50;

  // Header
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.setTextColor(11, 35, 79); // navy
  doc.text("Kit de Viagem", 50, y);
  y += 8;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(d.agencyName, 50, y + 12);
  doc.line(50, y + 22, W - 50, y + 22);
  y += 44;

  // Identification
  doc.setFontSize(11); doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold"); doc.text("Viajante:", 50, y);
  doc.setFont("helvetica", "normal"); doc.text(d.clientName, 120, y);
  y += 18;
  doc.setFont("helvetica", "bold"); doc.text("Código:", 50, y);
  doc.setFont("helvetica", "normal"); doc.text(d.accessCode, 120, y);
  y += 24;

  // Outcome
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.setTextColor(11, 35, 79);
  doc.text("Resultado do visto", 50, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(40, 40, 40);
  doc.text(`Status: ${d.outcome ?? "Aguardando"}`, 50, y); y += 14;
  if (d.decisionAt) { doc.text(`Decisão: ${new Date(d.decisionAt).toLocaleDateString("pt-BR")}`, 50, y); y += 14; }
  if (d.validityUntil) { doc.text(`Validade até: ${new Date(d.validityUntil).toLocaleDateString("pt-BR")}`, 50, y); y += 14; }
  y += 12;

  // Checklist
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(11, 35, 79);
  doc.text("Checklist de viagem", 50, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(40, 40, 40);
  for (const [key, label] of Object.entries(CHECKLIST_LABELS)) {
    const checked = d.checklist[key];
    doc.text(`${checked ? "[x]" : "[ ]"}  ${label}`, 50, y);
    y += 16;
    if (y > 760) { doc.addPage(); y = 50; }
  }
  y += 12;

  // Emergency contacts
  if (d.emergencyContacts.length > 0) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(11, 35, 79);
    doc.text("Contatos de emergência", 50, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(40, 40, 40);
    d.emergencyContacts.forEach((c) => {
      doc.setFont("helvetica", "bold"); doc.text(`${c.label}:`, 50, y);
      doc.setFont("helvetica", "normal"); doc.text(c.value, 160, y);
      y += 16;
      if (y > 760) { doc.addPage(); y = 50; }
    });
  }

  // Footer disclaimer
  doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  const disclaimer = "A Viajaly presta consultoria de viagem, não jurídica e não garante a aprovação de vistos. A decisão final é sempre do consulado.";
  const lines = doc.splitTextToSize(disclaimer, W - 100);
  doc.text(lines, 50, 800);

  doc.save(`kit-viagem-${d.clientName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
