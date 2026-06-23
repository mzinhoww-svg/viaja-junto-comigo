import { z } from "zod";

export type ProductKey = "passaporte" | "roteiro" | "milhas";

export const DISCLAIMERS: Record<ProductKey, string> = {
  milhas: "A Viajaly faz consultoria e otimização de milhas — não emite nem vende milhas.",
  passaporte: "A taxa da Polícia Federal é paga direto ao governo, à parte da consultoria.",
  roteiro: "O roteiro é uma sugestão de itinerário; reservas e compras são feitas por você ou com nosso apoio.",
};

export const TITLES: Record<ProductKey, string> = {
  passaporte: "Briefing — Passaporte",
  roteiro: "Briefing — Roteiro",
  milhas: "Briefing — Milhas",
};

// Field meta drives the generic BriefingForm renderer.
export type FieldKind =
  | { kind: "text"; label: string; placeholder?: string; required?: boolean }
  | { kind: "textarea"; label: string; placeholder?: string; required?: boolean }
  | { kind: "number"; label: string; required?: boolean; min?: number }
  | { kind: "date"; label: string; required?: boolean }
  | { kind: "select"; label: string; options: { value: string; label: string }[]; required?: boolean }
  | { kind: "multiselect"; label: string; options: { value: string; label: string }[] }
  | { kind: "boolean"; label: string };

export type FormField = FieldKind & { name: string; showIf?: (v: Record<string, unknown>) => boolean };

// ── Passaporte ────────────────────────────────────────────────
export const passaporteSchema = z.object({
  tipo: z.enum(["primeira_via", "renovacao"]),
  cidade_retirada_pf: z.string().trim().min(2).max(100),
  quinzena_pf: z.enum(["1q", "2q", "sem_preferencia"]),
  urgencia: z.enum(["normal", "expressa"]),
  tem_foto: z.boolean(),
  observacoes: z.string().max(1000).optional().nullable(),
  passaporte_anterior_num: z.string().max(50).optional().nullable(),
  passaporte_anterior_validade: z.string().optional().nullable(),
}).refine((v) => v.tipo !== "renovacao" || !!v.passaporte_anterior_num, {
  path: ["passaporte_anterior_num"],
  message: "Obrigatório em renovação",
});

export const passaporteFields: FormField[] = [
  { name: "tipo", kind: "select", label: "Tipo", required: true, options: [
    { value: "primeira_via", label: "1ª via" }, { value: "renovacao", label: "Renovação" } ] },
  { name: "passaporte_anterior_num", kind: "text", label: "Nº do passaporte anterior",
    showIf: (v) => v.tipo === "renovacao", required: true },
  { name: "passaporte_anterior_validade", kind: "date", label: "Validade do anterior",
    showIf: (v) => v.tipo === "renovacao" },
  { name: "cidade_retirada_pf", kind: "text", label: "Cidade de retirada (PF)", required: true,
    placeholder: "Ex.: São Paulo — Lapa" },
  { name: "quinzena_pf", kind: "select", label: "Quinzena preferida na PF", required: true, options: [
    { value: "1q", label: "1ª quinzena" }, { value: "2q", label: "2ª quinzena" }, { value: "sem_preferencia", label: "Sem preferência" } ] },
  { name: "urgencia", kind: "select", label: "Urgência", required: true, options: [
    { value: "normal", label: "Normal" }, { value: "expressa", label: "Expressa" } ] },
  { name: "tem_foto", kind: "boolean", label: "Já tenho foto 5x5 atualizada" },
  { name: "observacoes", kind: "textarea", label: "Observações", placeholder: "Restrições de horário, particularidades…" },
];

// ── Roteiro ───────────────────────────────────────────────────
export const roteiroSchema = z.object({
  destinos: z.string().trim().min(2).max(500),
  data_ida: z.string().min(1),
  data_volta: z.string().min(1),
  viajantes_n: z.coerce.number().int().min(1).max(20),
  criancas: z.enum(["nao", "sim"]),
  criancas_idades: z.string().max(100).optional().nullable(),
  estilo: z.enum(["economico", "conforto", "luxo"]),
  ritmo: z.enum(["tranquilo", "equilibrado", "intenso"]),
  interesses: z.array(z.enum(["gastronomia","compras","cultura","natureza","parques","vida_noturna"])).default([]),
  restricoes: z.string().max(1000).optional().nullable(),
  orcamento_total: z.coerce.number().min(0).optional().nullable(),
});

export const roteiroFields: FormField[] = [
  { name: "destinos", kind: "textarea", label: "Destinos desejados", required: true, placeholder: "Ex.: Orlando + Miami" },
  { name: "data_ida", kind: "date", label: "Data de ida", required: true },
  { name: "data_volta", kind: "date", label: "Data de volta", required: true },
  { name: "viajantes_n", kind: "number", label: "Nº de viajantes", required: true, min: 1 },
  { name: "criancas", kind: "select", label: "Vai levar crianças?", required: true, options: [
    { value: "nao", label: "Não" }, { value: "sim", label: "Sim" } ] },
  { name: "criancas_idades", kind: "text", label: "Idades das crianças",
    showIf: (v) => v.criancas === "sim", placeholder: "Ex.: 5, 9" },
  { name: "estilo", kind: "select", label: "Estilo", required: true, options: [
    { value: "economico", label: "Econômico" }, { value: "conforto", label: "Conforto" }, { value: "luxo", label: "Luxo" } ] },
  { name: "ritmo", kind: "select", label: "Ritmo", required: true, options: [
    { value: "tranquilo", label: "Tranquilo" }, { value: "equilibrado", label: "Equilibrado" }, { value: "intenso", label: "Intenso" } ] },
  { name: "interesses", kind: "multiselect", label: "Interesses", options: [
    { value: "gastronomia", label: "Gastronomia" }, { value: "compras", label: "Compras" },
    { value: "cultura", label: "Cultura" }, { value: "natureza", label: "Natureza" },
    { value: "parques", label: "Parques" }, { value: "vida_noturna", label: "Vida noturna" } ] },
  { name: "restricoes", kind: "textarea", label: "Restrições / observações", placeholder: "Alimentares, mobilidade, etc." },
  { name: "orcamento_total", kind: "number", label: "Orçamento total estimado (R$)", min: 0 },
];

// ── Milhas ────────────────────────────────────────────────────
export const milhasSchema = z.object({
  programas: z.array(z.enum(["latam","smiles","azul","tudo"])).default([]),
  cpfs_familia: z.string().max(500).optional().nullable(),
  cartoes: z.string().max(500).optional().nullable(),
  objetivo: z.enum(["acumular","resgatar","transferir","manter_status"]),
  trecho_alvo: z.string().max(200).optional().nullable(),
  pontos_atuais: z.coerce.number().min(0).optional().nullable(),
  saldo_faixa: z.enum(["<50k","50_200k","200k_1M",">1M"]),
  gasto_mensal_faixa: z.enum(["<2k","2_10k","10_30k",">30k"]),
  esforco: z.enum(["baixo","medio","alto"]),
  aceita_transferencia_bancaria: z.boolean(),
});

export const milhasFields: FormField[] = [
  { name: "programas", kind: "multiselect", label: "Programas de interesse", options: [
    { value: "latam", label: "Latam Pass" }, { value: "smiles", label: "Smiles" },
    { value: "azul", label: "Azul Tudo Azul" }, { value: "tudo", label: "Todos" } ] },
  { name: "objetivo", kind: "select", label: "Objetivo", required: true, options: [
    { value: "acumular", label: "Acumular" }, { value: "resgatar", label: "Resgatar" },
    { value: "transferir", label: "Transferir" }, { value: "manter_status", label: "Manter status" } ] },
  { name: "trecho_alvo", kind: "text", label: "Trecho alvo (se houver)", placeholder: "Ex.: GRU → MIA, classe executiva" },
  { name: "pontos_atuais", kind: "number", label: "Pontos atuais somados (aprox.)", min: 0 },
  { name: "saldo_faixa", kind: "select", label: "Faixa de saldo total", required: true, options: [
    { value: "<50k", label: "Até 50 mil" }, { value: "50_200k", label: "50–200 mil" },
    { value: "200k_1M", label: "200 mil – 1 milhão" }, { value: ">1M", label: "Acima de 1 milhão" } ] },
  { name: "gasto_mensal_faixa", kind: "select", label: "Gasto mensal em cartão", required: true, options: [
    { value: "<2k", label: "Até R$ 2k" }, { value: "2_10k", label: "R$ 2–10k" },
    { value: "10_30k", label: "R$ 10–30k" }, { value: ">30k", label: "Acima de R$ 30k" } ] },
  { name: "esforco", kind: "select", label: "Nível de esforço disponível", required: true, options: [
    { value: "baixo", label: "Baixo" }, { value: "medio", label: "Médio" }, { value: "alto", label: "Alto" } ] },
  { name: "cpfs_familia", kind: "textarea", label: "CPFs da família (opcional)", placeholder: "Para clube/pool familiar" },
  { name: "cartoes", kind: "textarea", label: "Cartões que possui", placeholder: "Bandeira e categoria" },
  { name: "aceita_transferencia_bancaria", kind: "boolean", label: "Aceito bônus por transferência bancária" },
];

export const SCHEMAS: Record<ProductKey, { schema: z.ZodTypeAny; fields: FormField[] }> = {
  passaporte: { schema: passaporteSchema, fields: passaporteFields },
  roteiro: { schema: roteiroSchema, fields: roteiroFields },
  milhas: { schema: milhasSchema, fields: milhasFields },
};
