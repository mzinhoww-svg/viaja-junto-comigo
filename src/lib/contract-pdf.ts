import { jsPDF } from "jspdf";

export type ContractAuditTrail = {
  signerName: string;
  signerCpf?: string | null;
  signedAtISO: string;       // ISO UTC
  ip: string;
  userAgent: string;
  bodySha256: string;
  acceptedTermsAtISO: string;
};

/**
 * Gera o PDF do contrato no momento do aceite, com a trilha forense
 * (IP, hash SHA-256, data/hora UTC, navegador) no rodapé de cada página.
 * Devolve um Blob pronto para upload no Storage.
 */
export function buildContractPdf(opts: {
  agencyName: string;
  title?: string;
  bodyHtml: string;
  audit: ContractAuditTrail;
}): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const MARGIN = 48;
  const CONTENT_W = W - MARGIN * 2;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(11, 35, 79);
  doc.text(opts.title ?? "Contrato de Prestação de Serviços", MARGIN, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(opts.agencyName, MARGIN, 76);
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, 86, W - MARGIN, 86);

  // Corpo — converte HTML em texto plano simples (mantém parágrafos)
  const plain = htmlToText(opts.bodyHtml);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 30, 30);
  const lines = doc.splitTextToSize(plain, CONTENT_W);
  let y = 110;
  const lineHeight = 14;
  const bottomLimit = H - 120; // espaço pro rodapé forense
  for (const ln of lines) {
    if (y > bottomLimit) {
      drawFooter(doc, opts.audit, W, H, MARGIN);
      doc.addPage();
      y = 60;
    }
    doc.text(ln, MARGIN, y);
    y += lineHeight;
  }

  drawFooter(doc, opts.audit, W, H, MARGIN);

  const buf = doc.output("arraybuffer");
  return new Blob([buf], { type: "application/pdf" });
}

function drawFooter(
  doc: jsPDF,
  a: ContractAuditTrail,
  W: number,
  H: number,
  MARGIN: number,
) {
  const y0 = H - 96;
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y0, W - MARGIN, y0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(11, 35, 79);
  doc.text("Trilha jurídica de assinatura (MP 2.200-2/2001)", MARGIN, y0 + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  const signedAt = new Date(a.signedAtISO);
  const acceptedAt = new Date(a.acceptedTermsAtISO);
  const lines = [
    `Signatário: ${a.signerName}${a.signerCpf ? ` — CPF ${a.signerCpf}` : ""}`,
    `Aceite explícito dos termos em: ${acceptedAt.toISOString()} (UTC)`,
    `Assinado em: ${signedAt.toISOString()} (UTC)`,
    `IP: ${a.ip || "—"}    Navegador: ${truncate(a.userAgent, 90)}`,
    `Hash SHA-256 do contrato: ${a.bodySha256}`,
  ];
  let yy = y0 + 30;
  for (const l of lines) {
    doc.text(l, MARGIN, yy);
    yy += 11;
  }
}

function truncate(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** SHA-256 do snapshot HTML, em hex, usando WebCrypto (browser). */
export async function sha256HexBrowser(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
