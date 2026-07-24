import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  selecionarTemplates,
  type ChecklistTemplateRow,
  type TripVariables,
} from "./trip-templates";

/**
 * Carrega o catálogo real de `checklist_templates` a partir das migrations
 * seedadas (VJT-001 + VJT-003 + VJT-003b), na mesma ordem em que são
 * aplicadas no Supabase. Isso garante que o teste de contagem da faixa
 * 80-120 (Seção 2 / VIAJALY-TRIP.md) valide os dados que de fato vão para
 * o banco, não uma amostra sintética que pode divergir da migration.
 */
const SEED_MIGRATIONS = [
  "20260723120000_viajaly_trip_initial_schema.sql",
  "20260724150000_vjt003_trip_wizard.sql",
  "20260724180000_vjt003b_premium_catalog_generic.sql",
];

function migrationPath(filename: string): string {
  return fileURLToPath(new URL(`../../supabase/migrations/${filename}`, import.meta.url));
}

/** Divide o corpo de um `values (...), (...), ...;` em tuplas top-level, respeitando parênteses/aspas dentro dos títulos (ex.: "Passaporte válido (mínimo 6 meses...)"). */
function parseTuples(valuesBlob: string): string[] {
  const tuples: string[] = [];
  let i = 0;
  const n = valuesBlob.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(valuesBlob[i])) i++;
    if (i >= n) break;
    if (valuesBlob[i] !== "(") {
      throw new Error(`Esperava '(' na posição ${i} de: ${valuesBlob.slice(i, i + 30)}`);
    }
    const start = i;
    let depth = 0;
    let inString = false;
    for (; i < n; i++) {
      const ch = valuesBlob[i];
      if (inString) {
        if (ch === "'") {
          if (valuesBlob[i + 1] === "'") {
            i++;
            continue;
          }
          inString = false;
        }
        continue;
      }
      if (ch === "'") {
        inString = true;
        continue;
      }
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    tuples.push(valuesBlob.slice(start + 1, i - 1));
  }
  return tuples;
}

/** Divide o conteúdo de uma tupla em campos, respeitando vírgulas dentro de strings quotadas. */
function splitFields(tupleContent: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < tupleContent.length; i++) {
    const ch = tupleContent[i];
    if (inString) {
      if (ch === "'") {
        if (tupleContent[i + 1] === "'") {
          current += "'";
          i++;
          continue;
        }
        inString = false;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === "'") {
      inString = true;
      continue;
    }
    if (ch === ",") {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

function parseNumberOrNull(raw: string): number | null {
  return raw.toLowerCase() === "null" ? null : Number(raw);
}

function parseBooleanOrNull(raw: string): boolean | null {
  if (raw.toLowerCase() === "null") return null;
  return raw.toLowerCase() === "true";
}

/** Extrai todas as linhas de `checklist_templates` seedadas nas migrations, na ordem real de aplicação. */
function carregarCatalogoReal(): ChecklistTemplateRow[] {
  const rows: ChecklistTemplateRow[] = [];
  let idCounter = 0;

  for (const filename of SEED_MIGRATIONS) {
    const sql = readFileSync(migrationPath(filename), "utf-8");
    const insertRegex =
      /insert into public\.checklist_templates\s*\(([^)]+)\)\s*values\s*([\s\S]*?);/g;
    let match: RegExpExecArray | null;
    while ((match = insertRegex.exec(sql)) !== null) {
      const columns = match[1].split(",").map((c) => c.trim());
      const tuples = parseTuples(match[2]);
      for (const tuple of tuples) {
        const fields = splitFields(tuple);
        const byColumn = new Map(columns.map((col, idx) => [col, fields[idx]]));

        const row: ChecklistTemplateRow = {
          id: `seed-${idCounter++}`,
          tipo: byColumn.get("tipo") as ChecklistTemplateRow["tipo"],
          titulo: byColumn.get("titulo") ?? "",
          marco: byColumn.has("marco") ? parseNumberOrNull(byColumn.get("marco")!) : null,
          prazoDiasAntes: byColumn.has("prazo_dias_antes")
            ? parseNumberOrNull(byColumn.get("prazo_dias_antes")!)
            : null,
          tier: (byColumn.get("tier") as ChecklistTemplateRow["tier"]) ?? "free",
          regiao: byColumn.has("regiao") ? byColumn.get("regiao")! : null,
          clima: byColumn.has("clima") ? byColumn.get("clima")! : null,
          minDuracao: byColumn.has("min_duracao")
            ? parseNumberOrNull(byColumn.get("min_duracao")!)
            : null,
          comCrianca: byColumn.has("com_crianca")
            ? parseBooleanOrNull(byColumn.get("com_crianca")!)
            : null,
          destinoPack: byColumn.has("destino_pack") ? byColumn.get("destino_pack")! : null,
          ordem: byColumn.has("ordem") ? (parseNumberOrNull(byColumn.get("ordem")!) ?? 0) : 0,
        };
        rows.push(row);
      }
    }
  }

  return rows;
}

const catalogo = carregarCatalogoReal();

function varsSemPack(overrides: Partial<TripVariables>): TripVariables {
  return {
    regiao: null,
    clima: null,
    destinoPack: null,
    comCriancas: false,
    duracaoDias: null,
    ...overrides,
  };
}

describe("catálogo real de checklist_templates (migrations seedadas)", () => {
  it("o parser encontra as linhas esperadas nas migrations (sanity check)", () => {
    // free (VJT-001: 15) + free (VJT-003: 15) + premium diversos (VJT-003) + genérico novo (VJT-003b: 45)
    expect(catalogo.length).toBeGreaterThan(140);
    expect(catalogo.every((t) => t.tipo && t.titulo)).toBe(true);
  });

  it("free soma ~30 itens, nenhum premium", () => {
    const selecionados = selecionarTemplates(catalogo, "free", varsSemPack({}));
    expect(selecionados.length).toBeGreaterThanOrEqual(28);
    expect(selecionados.length).toBeLessThanOrEqual(32);
    expect(selecionados.every((t) => t.tier === "free")).toBe(true);
  });

  it("premium sem pack — Tóquio/Japão (regiao asia, clima tropical): total entre 80 e 120", () => {
    const selecionados = selecionarTemplates(
      catalogo,
      "premium",
      varsSemPack({ regiao: "asia", clima: "tropical" }),
    );
    expect(selecionados.length).toBeGreaterThanOrEqual(80);
    expect(selecionados.length).toBeLessThanOrEqual(120);
    expect(selecionados.some((t) => t.destinoPack != null)).toBe(false);
  });

  it("premium sem pack — Santiago/Chile (regiao america_sul, clima frio): total entre 80 e 120", () => {
    const selecionados = selecionarTemplates(
      catalogo,
      "premium",
      varsSemPack({ regiao: "america_sul", clima: "frio" }),
    );
    expect(selecionados.length).toBeGreaterThanOrEqual(80);
    expect(selecionados.length).toBeLessThanOrEqual(120);
  });

  it("premium sem pack + com criança ainda fica dentro de um teto razoável (não estoura muito acima de 120)", () => {
    const selecionados = selecionarTemplates(
      catalogo,
      "premium",
      varsSemPack({ regiao: "asia", clima: "tropical", comCriancas: true }),
    );
    expect(selecionados.length).toBeLessThanOrEqual(120);
  });

  it("premium com pack (Orlando) continua dentro de um teto razoável, sem estourar muito acima de 120", () => {
    const selecionados = selecionarTemplates(
      catalogo,
      "premium",
      varsSemPack({ regiao: "america_norte", clima: "quente", destinoPack: "orlando" }),
    );
    expect(selecionados.length).toBeLessThanOrEqual(120);
  });
});
