export const SERVICES = ["casv", "entrevista", "pf"] as const;
export type Service = (typeof SERVICES)[number];

export const SERVICE_LABEL: Record<Service, string> = {
  casv: "CASV (biometria)",
  entrevista: "Entrevista (consulado)",
  pf: "Polícia Federal (passaporte)",
};

export const SERVICE_SHORT: Record<Service, string> = {
  casv: "CASV",
  entrevista: "Entrevista",
  pf: "PF",
};

export const SERVICE_COLOR: Record<Service, string> = {
  casv: "bg-coral text-cream",
  entrevista: "bg-navy text-cream",
  pf: "bg-amber-500 text-white",
};

export const SERVICE_REQUIRED: Record<Service, boolean> = {
  casv: true,
  entrevista: true,
  pf: false,
};

export const CONSULATES = ["SP", "RJ", "BSB", "POA", "REC"] as const;
export type Consulate = (typeof CONSULATES)[number];

export const CONSULATE_LABEL: Record<Consulate, string> = {
  SP: "São Paulo",
  RJ: "Rio de Janeiro",
  BSB: "Brasília",
  POA: "Porto Alegre",
  REC: "Recife",
};

export const PERIOD_LABEL: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  any: "Qualquer",
};

export function googleCalUrl(opts: {
  title: string;
  date: string; // YYYY-MM-DD
  details?: string;
  location?: string;
}) {
  const d = opts.date.replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${d}/${d}`,
    details: opts.details ?? "",
    location: opts.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
