// Espelho simplificado das seções do DS-160 (PT-BR).
// A equipe Viajaly preenche o oficial; aqui apenas coletamos os dados.

export type FieldType = "text" | "date" | "select" | "yesno" | "textarea";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
};

export type Section = {
  key: string;
  title: string;
  hint?: string;
  fields: Field[];
};

export const DS160_SECTIONS: Section[] = [
  {
    key: "personal",
    title: "1. Dados pessoais",
    fields: [
      { key: "full_name", label: "Nome completo (como no passaporte)", type: "text", required: true },
      { key: "maiden_name", label: "Sobrenome de solteiro(a) (se aplicável)", type: "text" },
      { key: "other_names", label: "Outros nomes usados (apelidos, nome social)", type: "text" },
      { key: "birth_date", label: "Data de nascimento", type: "date", required: true },
      { key: "birth_city", label: "Cidade de nascimento", type: "text", required: true },
      { key: "birth_country", label: "País de nascimento", type: "text", required: true },
      { key: "sex", label: "Sexo", type: "select", required: true, options: ["Masculino", "Feminino"] },
      { key: "marital_status", label: "Estado civil", type: "select", required: true, options: ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)", "Separado(a)"] },
      { key: "nationalities", label: "Nacionalidades (separar por vírgula)", type: "text", required: true },
      { key: "cpf", label: "CPF", type: "text", required: true },
    ],
  },
  {
    key: "address",
    title: "2. Endereço & contato",
    fields: [
      { key: "address_street", label: "Endereço residencial", type: "text", required: true },
      { key: "address_city", label: "Cidade", type: "text", required: true },
      { key: "address_state", label: "Estado", type: "text", required: true },
      { key: "address_zip", label: "CEP", type: "text", required: true },
      { key: "address_country", label: "País", type: "text", required: true },
      { key: "phone_primary", label: "Telefone principal (com DDI)", type: "text", required: true },
      { key: "phone_secondary", label: "Telefone secundário", type: "text" },
      { key: "email", label: "E-mail", type: "text", required: true },
      { key: "social_media", label: "Redes sociais (últimos 5 anos: Instagram, Facebook, X, etc.)", type: "textarea", help: "Use o handle (@usuario) e a plataforma" },
    ],
  },
  {
    key: "passport",
    title: "3. Passaporte",
    fields: [
      { key: "passport_number", label: "Número do passaporte", type: "text", required: true },
      { key: "passport_issue_country", label: "País emissor", type: "text", required: true },
      { key: "passport_issue_date", label: "Data de emissão", type: "date", required: true },
      { key: "passport_expiry_date", label: "Data de validade", type: "date", required: true },
      { key: "passport_lost", label: "Já perdeu ou teve passaporte roubado?", type: "yesno", required: true },
      { key: "passport_lost_details", label: "Detalhes (se sim)", type: "textarea" },
    ],
  },
  {
    key: "trip",
    title: "4. Viagem",
    fields: [
      { key: "trip_purpose", label: "Propósito da viagem", type: "select", required: true, options: ["Turismo", "Negócios", "Estudo", "Tratamento médico", "Visita a familiares", "Outro"] },
      { key: "trip_arrival_date", label: "Data prevista de chegada nos EUA", type: "date", required: true },
      { key: "trip_duration_days", label: "Duração prevista (dias)", type: "text", required: true },
      { key: "trip_us_address", label: "Endereço onde ficará nos EUA (hotel ou amigo)", type: "textarea", required: true },
      { key: "trip_paid_by", label: "Quem paga a viagem?", type: "select", required: true, options: ["Eu mesmo(a)", "Familiar", "Empresa", "Outro"] },
      { key: "trip_companions", label: "Companheiros de viagem (nome + parentesco)", type: "textarea" },
    ],
  },
  {
    key: "previous",
    title: "5. Viagens anteriores",
    fields: [
      { key: "us_been_before", label: "Já esteve nos EUA?", type: "yesno", required: true },
      { key: "us_last_visit", label: "Última visita (data + duração)", type: "text" },
      { key: "us_visa_before", label: "Já teve visto americano?", type: "yesno", required: true },
      { key: "us_visa_number", label: "Número do visto anterior", type: "text" },
      { key: "us_visa_refused", label: "Já teve visto recusado por qualquer país?", type: "yesno", required: true },
      { key: "us_visa_refused_details", label: "Detalhes da recusa (se sim)", type: "textarea" },
      { key: "other_countries", label: "Países visitados nos últimos 5 anos", type: "textarea" },
    ],
  },
  {
    key: "family",
    title: "6. Família",
    fields: [
      { key: "father_name", label: "Nome do pai", type: "text", required: true },
      { key: "father_birth_date", label: "Data de nascimento do pai", type: "date" },
      { key: "father_in_us", label: "Pai está nos EUA?", type: "yesno", required: true },
      { key: "mother_name", label: "Nome da mãe", type: "text", required: true },
      { key: "mother_birth_date", label: "Data de nascimento da mãe", type: "date" },
      { key: "mother_in_us", label: "Mãe está nos EUA?", type: "yesno", required: true },
      { key: "spouse_name", label: "Nome do cônjuge (se casado)", type: "text" },
      { key: "spouse_birth_date", label: "Data de nascimento do cônjuge", type: "date" },
      { key: "relatives_in_us", label: "Parentes próximos nos EUA (nome + parentesco + status)", type: "textarea" },
    ],
  },
  {
    key: "work",
    title: "7. Trabalho & educação",
    fields: [
      { key: "occupation", label: "Ocupação atual", type: "text", required: true },
      { key: "employer_name", label: "Empresa/empregador", type: "text", required: true },
      { key: "employer_address", label: "Endereço da empresa", type: "textarea", required: true },
      { key: "employer_phone", label: "Telefone da empresa", type: "text" },
      { key: "salary_monthly", label: "Salário mensal (R$)", type: "text", required: true },
      { key: "job_description", label: "Descrição das atividades", type: "textarea", required: true },
      { key: "education_level", label: "Nível de escolaridade", type: "select", required: true, options: ["Ensino médio", "Técnico", "Superior", "Pós-graduação", "Mestrado", "Doutorado"] },
      { key: "education_institution", label: "Última instituição de ensino", type: "text", required: true },
      { key: "languages", label: "Idiomas falados", type: "text", required: true },
    ],
  },
  {
    key: "security",
    title: "8. Segurança (perguntas obrigatórias)",
    hint: "Responda com sinceridade. Todas são perguntas oficiais do DS-160.",
    fields: [
      { key: "sec_disease", label: "Tem alguma doença contagiosa de relevância para saúde pública?", type: "yesno", required: true },
      { key: "sec_mental", label: "Tem transtorno mental ou físico que represente risco?", type: "yesno", required: true },
      { key: "sec_drugs", label: "É ou já foi usuário/dependente de drogas?", type: "yesno", required: true },
      { key: "sec_crime", label: "Já foi preso ou condenado por qualquer crime?", type: "yesno", required: true },
      { key: "sec_drug_traffic", label: "Esteve envolvido em tráfico de drogas?", type: "yesno", required: true },
      { key: "sec_terrorism", label: "Pretende ou já se envolveu em atividades terroristas ou de espionagem?", type: "yesno", required: true },
      { key: "sec_genocide", label: "Esteve envolvido em genocídio, tortura ou execuções extrajudiciais?", type: "yesno", required: true },
      { key: "sec_child_custody", label: "Reteve guarda de menor cidadão americano fora dos EUA?", type: "yesno", required: true },
      { key: "sec_overstay", label: "Já excedeu o prazo de permanência em visto americano?", type: "yesno", required: true },
      { key: "sec_notes", label: "Observações adicionais (opcional)", type: "textarea" },
    ],
  },
];

export const ALL_FIELDS: Field[] = DS160_SECTIONS.flatMap((s) => s.fields);
export const REQUIRED_FIELDS: Field[] = ALL_FIELDS.filter((f) => f.required);

export function computeCompletion(form: Record<string, unknown>): number {
  if (REQUIRED_FIELDS.length === 0) return 100;
  let filled = 0;
  for (const f of REQUIRED_FIELDS) {
    const v = form[f.key];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    filled++;
  }
  return Math.round((filled / REQUIRED_FIELDS.length) * 100);
}
