// Motivos de reprovação padrão para revisão de documentos (Build Spec §9.6).
// O admin escolhe um motivo padrão (preenche o texto) ou "Outro" para descrever livremente.

export const REJECT_REASONS = [
  "Imagem ilegível ou cortada",
  "Documento vencido",
  "Dados divergentes do cadastro",
  "Documento incompleto (falta página/verso)",
  "Foto fora do padrão (fundo/enquadramento)",
] as const;

export const REJECT_REASON_OTHER = "Outro (descrever)";
