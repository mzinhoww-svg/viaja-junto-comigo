import { supabase } from "@/integrations/supabase/client";

// Teste A/B leve: variante sorteada 1x por navegador (sticky no localStorage),
// eventos view/convert gravados em ab_events (dedupe por sessão). Nunca quebra a página.

function safeLS(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

export function getSessionId(): string {
  const ls = safeLS();
  if (!ls) return "anon";
  let s = ls.getItem("viajaly_sid");
  if (!s) {
    s = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2);
    ls.setItem("viajaly_sid", s);
  }
  return s;
}

export function getVariant(experiment: string, variants: string[]): string {
  const fallback = variants[0] ?? "A";
  const ls = safeLS();
  if (!ls || variants.length === 0) return fallback;
  const key = `viajaly_ab_${experiment}`;
  const stored = ls.getItem(key);
  if (stored && variants.includes(stored)) return stored;
  const pick = variants[Math.floor(Math.random() * variants.length)];
  ls.setItem(key, pick);
  return pick;
}

export async function trackAb(experiment: string, variant: string, event: "view" | "convert") {
  const ls = safeLS();
  const dedupeKey = `viajaly_ab_${experiment}_${event}`;
  if (ls?.getItem(dedupeKey)) return; // 1 view / 1 convert por sessão
  ls?.setItem(dedupeKey, "1");
  try {
    await supabase.from("ab_events").insert({ experiment, variant, event, session_id: getSessionId() });
  } catch { /* tracking silencioso */ }
}
