// Espelho das seções do DS-160 (PT-BR) com metadados para máscara, condicionais,
// mapeamento de-para (seção oficial), subseções visuais e perguntas de
// elegibilidade (revisão humana).
// A equipe Viajaly preenche o oficial; aqui apenas coletamos os dados.

export type FieldType = "text" | "date" | "select" | "yesno" | "textarea";
export type FieldMask = "cpf" | "cep" | "phone" | "mrz";

/** Condição de visibilidade declarativa (campo aparece só quando a regra é verdadeira). */
export type FieldWhen = { field: string; equals?: string; in?: string[] };

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  mask?: FieldMask;
  /** Seção oficial do DS-160 (para o pacote de-para). */
  ds160Section?: string;
  /** Visível apenas quando a condição bate. */
  when?: FieldWhen;
  /** Pergunta de elegibilidade/segurança: "Sim" dispara revisão humana obrigatória. */
  flag?: "review";
  /** Rótulo de subseção (renderizado como subtítulo dentro da seção). */
  subsection?: string;
};

export type Section = {
  key: string;
  title: string;
  /** Subtítulo curto, abaixo do título da seção. */
  subtitle?: string;
  /** Ícone curto (emoji) usado no cabeçalho da seção. */
  icon?: string;
  /** Chip "Alimenta o DS-160 · <seção oficial>". */
  officialChip?: string;
  hint?: string;
  fields: Field[];
};

export const DS160_SECTIONS: Section[] = [
  {
    key: "identification",
    title: "Identificação",
    subtitle: "Como no seu passaporte",
    icon: "🪪",
    officialChip: "Personal Information 1 & 2",
    fields: [
      { key: "surname", label: "Sobrenome (como no passaporte)", type: "text", required: true, mask: "mrz", ds160Section: "Personal Information 1", help: "MAIÚSCULAS, sem acento (MRZ)" },
      { key: "given_name", label: "Nome (como no passaporte)", type: "text", required: true, mask: "mrz", ds160Section: "Personal Information 1", help: "MAIÚSCULAS, sem acento (MRZ)" },
      { key: "sex", label: "Sexo", type: "select", required: true, options: ["Masculino", "Feminino"], ds160Section: "Personal Information 1" },
      { key: "marital_status", label: "Estado civil", type: "select", required: true, options: ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)", "Separado(a)"], ds160Section: "Personal Information 1" },
      { key: "birth_date", label: "Data de nascimento", type: "date", required: true, ds160Section: "Personal Information 1" },
      { key: "nationality", label: "Nacionalidade atual", type: "text", required: true, placeholder: "Brasileira", ds160Section: "Personal Information 2" },
      { key: "birth_city", label: "Cidade de nascimento", type: "text", required: true, ds160Section: "Personal Information 1" },
      { key: "birth_state", label: "Estado de nascimento", type: "text", ds160Section: "Personal Information 1" },
      { key: "birth_country", label: "País de nascimento", type: "text", required: true, ds160Section: "Personal Information 1" },
      { key: "cpf", label: "CPF", type: "text", required: true, mask: "cpf", ds160Section: "Personal Information 2" },
      { key: "rg", label: "RG", type: "text", required: true, ds160Section: "Personal Information 2" },
      { key: "outra_nac", label: "Possui outra nacionalidade?", type: "yesno", required: true, ds160Section: "Personal Information 2" },
      { key: "qual_nac", label: "Qual outra nacionalidade?", type: "text", ds160Section: "Personal Information 2", when: { field: "outra_nac", equals: "Sim" } },
      { key: "passaporte_outra_nac", label: "Tem passaporte dessa outra nacionalidade?", type: "yesno", ds160Section: "Personal Information 2", when: { field: "outra_nac", equals: "Sim" } },
      { key: "had_other_names", label: "Já usou outros nomes (apelido, nome social, solteiro)?", type: "yesno", required: true, ds160Section: "Personal Information 2" },
      { key: "other_names", label: "Quais outros nomes?", type: "text", mask: "mrz", ds160Section: "Personal Information 2", when: { field: "had_other_names", equals: "Sim" } },
    ],
  },
  {
    key: "contact",
    title: "Contato",
    subtitle: "Onde te encontramos",
    icon: "📨",
    officialChip: "Address and Phone Information",
    fields: [
      { key: "email", label: "E-mail", type: "text", required: true, ds160Section: "Address and Phone" },
      { key: "phone_primary", label: "Celular / WhatsApp", type: "text", required: true, mask: "phone", placeholder: "(11) 90000-0000", ds160Section: "Address and Phone" },
      { key: "phone_secondary", label: "Telefone adicional", type: "text", mask: "phone", ds160Section: "Address and Phone" },
      { key: "address_zip", label: "CEP", type: "text", required: true, mask: "cep", placeholder: "00000-000", ds160Section: "Address and Phone" },
      { key: "address_street", label: "Endereço (rua, número, complemento)", type: "text", required: true, ds160Section: "Address and Phone" },
      { key: "address_neighborhood", label: "Bairro", type: "text", required: true, ds160Section: "Address and Phone" },
      { key: "address_city", label: "Cidade", type: "text", required: true, ds160Section: "Address and Phone" },
      { key: "address_state", label: "Estado", type: "text", required: true, ds160Section: "Address and Phone" },
      { key: "address_country", label: "País", type: "text", placeholder: "Brasil", ds160Section: "Address and Phone" },
    ],
  },
  {
    key: "passport",
    title: "Passaporte",
    subtitle: "Documento de viagem",
    icon: "🛂",
    officialChip: "Passport",
    fields: [
      { key: "passport_number", label: "Número do passaporte", type: "text", required: true, ds160Section: "Passport" },
      { key: "passport_issue_country", label: "País emissor", type: "text", required: true, placeholder: "Brasil", ds160Section: "Passport" },
      { key: "passport_issue_city", label: "Cidade / estado de emissão", type: "text", required: true, ds160Section: "Passport" },
      { key: "passport_issue_date", label: "Data de emissão", type: "date", required: true, ds160Section: "Passport" },
      { key: "passport_expiry_date", label: "Data de validade", type: "date", required: true, ds160Section: "Passport", help: "Deve ter validade mínima de 6 meses" },
      { key: "other_passport", label: "Possui outro passaporte?", type: "yesno", required: true, ds160Section: "Passport" },
      { key: "passport_lost", label: "Já teve passaporte perdido ou roubado?", type: "yesno", required: true, ds160Section: "Passport" },
      { key: "passport_lost_details", label: "Detalhes da perda/roubo", type: "textarea", ds160Section: "Passport", when: { field: "passport_lost", equals: "Sim" } },
    ],
  },
  {
    key: "trip",
    title: "Planejamento da viagem",
    subtitle: "Sua ida aos EUA",
    icon: "✈️",
    officialChip: "Travel + Travel Companions",
    fields: [
      { key: "trip_purpose", label: "Motivo da viagem", type: "select", required: true, options: ["Turismo", "Negócios", "Estudo", "Tratamento médico", "Visita a familiares", "Outro"], ds160Section: "Travel" },
      { key: "trip_destination_city", label: "Cidade de destino principal", type: "text", required: true, ds160Section: "Travel" },
      { key: "trip_us_address", label: "Endereço de hospedagem / hotel nos EUA", type: "textarea", required: true, ds160Section: "Travel" },
      { key: "trip_arrival_date", label: "Data prevista da viagem", type: "date", required: true, ds160Section: "Travel" },
      { key: "trip_duration_days", label: "Tempo estimado de permanência", type: "text", required: true, placeholder: "Ex.: 12 dias", ds160Section: "Travel" },
      { key: "trip_paid_by", label: "Quem paga a viagem?", type: "select", required: true, options: ["Eu mesmo(a)", "Familiar", "Empresa", "Outro"], ds160Section: "Travel" },
      { key: "trip_payer_name", label: "Nome de quem paga", type: "text", ds160Section: "Travel", when: { field: "trip_paid_by", in: ["Familiar", "Empresa", "Outro"] } },
      { key: "trip_payer_relation", label: "Relação com quem paga", type: "text", ds160Section: "Travel", when: { field: "trip_paid_by", in: ["Familiar", "Empresa", "Outro"] } },
      { key: "trip_with_companions", label: "Viajará acompanhado?", type: "yesno", required: true, ds160Section: "Travel Companions" },
      { key: "trip_companions", label: "Companheiros (nome + parentesco)", type: "textarea", ds160Section: "Travel Companions", when: { field: "trip_with_companions", equals: "Sim" } },
    ],
  },
  {
    key: "previous",
    title: "Histórico de viagens e vistos",
    subtitle: "Suas idas anteriores",
    icon: "🗺️",
    officialChip: "Previous U.S. Travel",
    fields: [
      { key: "us_been_before", label: "Já esteve nos EUA?", type: "yesno", required: true, ds160Section: "Previous U.S. Travel" },
      { key: "us_last_visit", label: "Datas e duração das últimas viagens", type: "textarea", ds160Section: "Previous U.S. Travel", when: { field: "us_been_before", equals: "Sim" } },
      { key: "us_visa_before", label: "Já teve visto americano?", type: "yesno", required: true, ds160Section: "Previous U.S. Travel" },
      { key: "prev_visa_type", label: "Tipo do último visto", type: "text", placeholder: "Ex.: B1/B2", ds160Section: "Previous U.S. Travel", when: { field: "us_visa_before", equals: "Sim" } },
      { key: "prev_visa_issue_date", label: "Data de emissão do visto", type: "date", ds160Section: "Previous U.S. Travel", when: { field: "us_visa_before", equals: "Sim" } },
      { key: "prev_visa_expiry_date", label: "Data de expiração do visto", type: "date", ds160Section: "Previous U.S. Travel", when: { field: "us_visa_before", equals: "Sim" } },
      { key: "us_visa_number", label: "Número do visto", type: "text", ds160Section: "Previous U.S. Travel", when: { field: "us_visa_before", equals: "Sim" } },
      { key: "us_visa_refused", label: "Já teve visto negado ou cancelado?", type: "yesno", required: true, ds160Section: "Previous U.S. Travel" },
      { key: "us_visa_refused_details", label: "Detalhes da recusa/cancelamento", type: "textarea", ds160Section: "Previous U.S. Travel", when: { field: "us_visa_refused", equals: "Sim" } },
      { key: "us_entry_denied", label: "Já teve entrada negada nos EUA?", type: "yesno", required: true, ds160Section: "Previous U.S. Travel" },
      { key: "us_petition", label: "Há petição de imigração em seu nome?", type: "yesno", required: true, ds160Section: "Previous U.S. Travel" },
    ],
  },
  {
    key: "family",
    title: "Família",
    subtitle: "Pais, cônjuge e contatos",
    icon: "👪",
    officialChip: "Family — Relatives & Spouse",
    fields: [
      { key: "father_name", label: "Nome do pai", type: "text", required: true, subsection: "Pais", ds160Section: "Family Relatives" },
      { key: "father_birth_date", label: "Data de nascimento do pai", type: "date", subsection: "Pais", ds160Section: "Family Relatives" },
      { key: "father_in_us", label: "Pai está nos EUA?", type: "yesno", required: true, subsection: "Pais", ds160Section: "Family Relatives" },
      { key: "mother_name", label: "Nome da mãe", type: "text", required: true, subsection: "Pais", ds160Section: "Family Relatives" },
      { key: "mother_birth_date", label: "Data de nascimento da mãe", type: "date", subsection: "Pais", ds160Section: "Family Relatives" },
      { key: "mother_in_us", label: "Mãe está nos EUA?", type: "yesno", required: true, subsection: "Pais", ds160Section: "Family Relatives" },
      { key: "spouse_name", label: "Nome do cônjuge", type: "text", subsection: "Cônjuge", ds160Section: "Family Spouse", when: { field: "marital_status", in: ["Casado(a)", "União estável"] } },
      { key: "spouse_birth_date", label: "Data de nascimento do cônjuge", type: "date", subsection: "Cônjuge", ds160Section: "Family Spouse", when: { field: "marital_status", in: ["Casado(a)", "União estável"] } },
      { key: "spouse_nationality", label: "Nacionalidade do cônjuge", type: "text", subsection: "Cônjuge", ds160Section: "Family Spouse", when: { field: "marital_status", in: ["Casado(a)", "União estável"] } },
      { key: "ex_spouse_name", label: "Nome do ex-cônjuge", type: "text", subsection: "Ex-cônjuge", ds160Section: "Family Spouse", when: { field: "marital_status", equals: "Divorciado(a)" } },
      { key: "ex_marriage_date", label: "Data do casamento", type: "date", subsection: "Ex-cônjuge", ds160Section: "Family Spouse", when: { field: "marital_status", equals: "Divorciado(a)" } },
      { key: "ex_divorce_date", label: "Data do divórcio", type: "date", subsection: "Ex-cônjuge", ds160Section: "Family Spouse", when: { field: "marital_status", equals: "Divorciado(a)" } },
      { key: "relatives_in_us_yesno", label: "Tem parentes nos EUA?", type: "yesno", required: true, subsection: "Parentes e contato nos EUA", ds160Section: "Family Relatives" },
      { key: "relatives_in_us", label: "Detalhe (nome + parentesco + status)", type: "textarea", subsection: "Parentes e contato nos EUA", ds160Section: "Family Relatives", when: { field: "relatives_in_us_yesno", equals: "Sim" } },
      { key: "us_contact", label: "Pessoa ou hotel de referência nos EUA", type: "text", required: true, subsection: "Parentes e contato nos EUA", placeholder: "Nome ou hotel", ds160Section: "Family Relatives" },
    ],
  },
  {
    key: "work",
    title: "Trabalho e renda",
    subtitle: "Situação profissional",
    icon: "💼",
    officialChip: "Work/Education — Present",
    fields: [
      { key: "employer_name", label: "Empresa atual (ou \"Autônomo\")", type: "text", required: true, ds160Section: "Present Work/Education" },
      { key: "occupation", label: "Cargo", type: "text", required: true, ds160Section: "Present Work/Education" },
      { key: "employer_address", label: "Endereço da empresa", type: "textarea", required: true, ds160Section: "Present Work/Education" },
      { key: "employer_phone", label: "Telefone da empresa", type: "text", mask: "phone", ds160Section: "Present Work/Education" },
      { key: "admission_date", label: "Data de admissão", type: "date", ds160Section: "Present Work/Education" },
      { key: "salary_monthly", label: "Renda mensal aproximada (R$)", type: "text", required: true, placeholder: "Ex.: 8.000", ds160Section: "Present Work/Education" },
      { key: "prev_employer", label: "Teve emprego nos últimos 5 anos?", type: "yesno", required: true, ds160Section: "Previous Work/Education" },
      { key: "prev_employer_details", label: "Empresa anterior, cargo e período", type: "textarea", ds160Section: "Previous Work/Education", when: { field: "prev_employer", equals: "Sim" } },
    ],
  },
  {
    key: "education",
    title: "Formação acadêmica",
    subtitle: "Onde você estudou",
    icon: "🎓",
    officialChip: "Work/Education — Previous",
    fields: [
      { key: "education_institution", label: "Instituição de ensino (mais recente)", type: "text", required: true, ds160Section: "Previous Work/Education" },
      { key: "education_course", label: "Curso", type: "text", required: true, ds160Section: "Previous Work/Education" },
      { key: "education_city", label: "Cidade / estado da instituição", type: "text", ds160Section: "Previous Work/Education" },
      { key: "education_start", label: "Início (MM/AAAA)", type: "text", ds160Section: "Previous Work/Education" },
      { key: "education_end", label: "Conclusão (MM/AAAA ou \"cursando\")", type: "text", ds160Section: "Previous Work/Education" },
      { key: "postgrad", label: "Tem pós, MBA ou especialização?", type: "yesno", required: true, ds160Section: "Previous Work/Education" },
      { key: "postgrad_details", label: "Detalhes da pós/MBA/especialização", type: "textarea", ds160Section: "Previous Work/Education", when: { field: "postgrad", equals: "Sim" } },
    ],
  },
  {
    key: "additional",
    title: "Informações complementares",
    subtitle: "Idiomas, viagens e segurança",
    icon: "🌐",
    officialChip: "Additional + Security/Background",
    hint: "Responda com sinceridade. Qualquer \"Sim\" nas perguntas de elegibilidade exige detalhamento e passa por revisão humana antes do envio oficial.",
    fields: [
      { key: "languages", label: "Idiomas que você fala", type: "text", required: true, ds160Section: "Additional Work/Education/Training" },
      { key: "other_countries", label: "Países visitados nos últimos 5 anos", type: "textarea", ds160Section: "Additional Work/Education/Training" },
      { key: "military_served", label: "Já prestou serviço militar?", type: "yesno", required: true, ds160Section: "Additional Work/Education/Training" },
      { key: "military_details", label: "Detalhes do serviço militar", type: "textarea", ds160Section: "Additional Work/Education/Training", when: { field: "military_served", equals: "Sim" } },
      { key: "sec_disease", label: "Possui doença contagiosa relevante para saúde pública?", type: "yesno", required: true, flag: "review", subsection: "Perguntas de elegibilidade (governo dos EUA)", ds160Section: "Security and Background" },
      { key: "sec_crime", label: "Já foi preso(a) ou condenado(a) por qualquer crime?", type: "yesno", required: true, flag: "review", subsection: "Perguntas de elegibilidade (governo dos EUA)", ds160Section: "Security and Background" },
      { key: "sec_drugs", label: "Envolvimento com substâncias ilícitas?", type: "yesno", required: true, flag: "review", subsection: "Perguntas de elegibilidade (governo dos EUA)", ds160Section: "Security and Background" },
      { key: "sec_immigration_fraud", label: "Já cometeu fraude migratória?", type: "yesno", required: true, flag: "review", subsection: "Perguntas de elegibilidade (governo dos EUA)", ds160Section: "Security and Background" },
      { key: "sec_overstay", label: "Já permaneceu além do permitido nos EUA?", type: "yesno", required: true, flag: "review", subsection: "Perguntas de elegibilidade (governo dos EUA)", ds160Section: "Security and Background" },
      { key: "sec_notes", label: "Detalhamento (obrigatório se respondeu \"Sim\" acima)", type: "textarea", subsection: "Perguntas de elegibilidade (governo dos EUA)", ds160Section: "Security and Background" },
    ],
  },
];

export const ALL_FIELDS: Field[] = DS160_SECTIONS.flatMap((s) => s.fields);
export const REQUIRED_FIELDS: Field[] = ALL_FIELDS.filter((f) => f.required);

/** Campo visível dado o estado atual do formulário (resolve condicionais `when`). */
export function isFieldVisible(field: Field, form: Record<string, unknown>): boolean {
  if (!field.when) return true;
  const v = form[field.when.field];
  if (field.when.equals !== undefined) return v === field.when.equals;
  if (field.when.in) return typeof v === "string" && field.when.in.includes(v);
  return true;
}

/** Conclusão considera apenas campos obrigatórios atualmente visíveis. */
export function computeCompletion(form: Record<string, unknown>): number {
  const required = REQUIRED_FIELDS.filter((f) => isFieldVisible(f, form));
  if (required.length === 0) return 100;
  let filled = 0;
  for (const f of required) {
    const v = form[f.key];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    filled++;
  }
  return Math.round((filled / required.length) * 100);
}

/** Chaves das perguntas de elegibilidade respondidas com "Sim". */
export function reviewFlags(form: Record<string, unknown>): string[] {
  return ALL_FIELDS.filter((f) => f.flag === "review" && form[f.key] === "Sim").map((f) => f.key);
}

/** Campos obrigatórios visíveis e ainda em branco para uma seção. */
export function missingRequiredInSection(section: Section, form: Record<string, unknown>): Field[] {
  return section.fields.filter((f) => {
    if (!f.required) return false;
    if (!isFieldVisible(f, form)) return false;
    const v = form[f.key];
    if (v === undefined || v === null) return true;
    if (typeof v === "string" && v.trim() === "") return true;
    return false;
  });
}

/** Total de obrigatórios visíveis numa seção. */
export function requiredVisibleInSection(section: Section, form: Record<string, unknown>): number {
  return section.fields.filter((f) => f.required && isFieldVisible(f, form)).length;
}
