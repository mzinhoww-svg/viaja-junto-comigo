// Pacote de-para DS-160 (peça-chave do Build Spec §10.5):
// gera um JSON estruturado { generatedAt, client, fields:[{key,label,ds160Section,format,required,value}] }
// cobrindo 100% dos campos VISÍVEIS (exclui condicionais ocultos), para o preenchimento oficial.

import { DS160_SECTIONS, isFieldVisible, type Field } from "./ds160-schema";

export type DePara = {
  generatedAt: string;
  client: { traveler: string; request: string };
  fields: {
    section: string;
    key: string;
    label: string;
    ds160Section: string;
    format: string;
    required: boolean;
    value: string;
  }[];
};

function fmt(field: Field): string {
  if (field.mask === "cpf") return "000.000.000-00";
  if (field.mask === "cep") return "00000-000";
  if (field.mask === "phone") return "(00) 00000-0000";
  if (field.mask === "mrz") return "MAIÚSCULAS sem acento (MRZ)";
  if (field.type === "date") return "DD-MMM-AAAA";
  if (field.type === "yesno") return "Sim/Não";
  if (field.type === "select") return (field.options ?? []).join(" | ");
  return "texto";
}

export function buildDs160Package(
  form: Record<string, unknown>,
  client: { traveler: string; request: string },
): DePara {
  const fields: DePara["fields"] = [];
  for (const section of DS160_SECTIONS) {
    for (const field of section.fields) {
      if (!isFieldVisible(field, form)) continue;
      const raw = form[field.key];
      fields.push({
        section: section.title,
        key: field.key,
        label: field.label,
        ds160Section: field.ds160Section ?? section.title,
        format: fmt(field),
        required: !!field.required,
        value: raw === undefined || raw === null ? "" : String(raw),
      });
    }
  }
  return { generatedAt: new Date().toISOString(), client, fields };
}

/** Dispara o download do pacote de-para como arquivo .json. */
export function downloadDs160Package(pkg: DePara, fileName: string) {
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
