// Espelho das seções do DS-160 (PT-BR) com metadados para máscara, condicionais,
// mapeamento de-para (seção oficial) e perguntas de elegibilidade (revisão humana).
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
      { key: "full_name", label: "Nome completo (como no passaporte)", type: "text", required: true, mask: "mrz", ds160Section: "Personal Information 1", help: "MAIÚSCULAS, sem acento (padrão do passaporte)" },
      { key: "maiden_name", label: "Sobrenome de solteiro(a) (se aplicável)", type: "text", mask: "mrz", ds160Section: "Personal Information 1" },
      { key: "other_names", label: "Outros nomes usados (apelidos, nome social)", type: "text", mask: "mrz", ds160Section: "Personal Information 2" },
      { key: "birth_date", label: "Data de nascimento", type: "date", required: true, ds160Section: "Personal Information 1" },
      { key: "birth_city", label: "Cidade de nascimento", type: "text", required: true, ds160Section: "Personal Information 1" },
      { key: "birth_country", label: "País de nascimento", type: "text", required: true, ds160Section: "Personal Information 1" },
      { key: "sex", label: "Sexo", type: "select", required: true, options: ["Masculino", "Feminino"], ds160Section: "Personal Information 1" },
      { key: "marital_status", label: "Estado civil", type: "select", required: true, options: ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)", "Separado(a)"], ds160Section: "Personal Information 1" },
      { key: "nationalities", label: "Nacionalidades (separar por vírgula)", type: "text", required: true, ds160Section: "Personal Information 2" },
      { key: "cpf", label: "CPF", type: "text", required: true, mask: "cpf", ds160Section: "Personal Information 2" },
      { key: "rg", label: "RG", type: "text", required: true, ds160Section: "Personal Information 2" },
      { key: "outra_nac", label: "Possui outra nacionalidade?", type: "yesno", required: true, ds160Section: "Personal Information 2" },
      { key: "qual_nac", label: "Qual outra nacionalidade?", type: "text", ds160Section: "Personal Information 2", when: { field: "outra_nac", equals: "Sim" } },
      { key: "passaporte_outra_nac", label: "Tem passaporte dessa outra nacionalidade?", type: "yesno", ds160Section: "Personal Information 2", when: { field: "outra_nac", equals: "Sim" } },
    ],
  },
  {
    key: "address",
    title: "2. Endereço & contato",
    fields: [
      { key: "address_street", label: "Endereço residencial", type: "text", required: true, ds160Section: "Address and Phone" },
      { key: "address_neighborhood", label: "Bairro", type: "text", required: true, ds160Section: "Address and Phone" },
      { key: "address_city", label: "Cidade", type: "text", required: true, ds160Section: "Address and Phone" },
      { key: "address_state", label: "Estado", type: "text", required: true, ds160Section: "Address and Phone" },
      { key: "address_zip", label: "CEP", type: "text", required: true, mask: "cep", ds160Section: "Address and Phone" },
      { key: "address_country", label: "País", type: "text", required: true, ds160Section: "Address and Phone" },
      { key: "phone_primary", label: "Telefone principal", type: "text", required: true, mask: "phone", ds160Section: "Address and Phone" },
      { key: "phone_secondary", label: "Telefone secundário", type: "text", mask: "phone", ds160Section: "Address and Phone" },
      { key: "email", label: "E-mail", type: "text", required: true, ds160Section: "Address and Phone" },
      { key: "social_media", label: "Redes sociais (últimos 5 anos)", type: "textarea", help: "Use o handle (@usuario) e a plataforma", ds160Section: "Address and Phone" },
    ],
  },
  {
    key: "passport",
    title: "3. Passaporte",
    fields: [
      { key: "passport_number", label: "Número do passaporte", type: "text", required: true, ds160Section: "Passport" },
      { key: "passport_issue_country", label: "País emissor", type: "text", required: true, ds160Section: "Passport" },
      { key: "passport_issue_date", label: "Data de emissão", type: "date", required: true, ds160Section: "Passport" },
      { key: "passport_expiry_date", label: "Data de validade", type: "date", required: true, ds160Section: "Passport", help: "Deve ter validade mínima de 6 meses" },
      { key: "passport_lost", label: "Já perdeu ou teve passaporte roubado?", type: "yesno", required: true, ds160Section: "Passport" },
      { key: "passport_lost_details", label: "Detalhes da perda/roubo", type: "textarea", ds160Section: "Passport", when: { field: "passport_lost", equals: "Sim" } },
    ],
  },
  {
    key: "trip",
    title: "4. Viagem",
    fields: [
      { key: "trip_purpose", label: "Propósito da viagem", type: "select", required: true, options: ["Turismo", "Negócios", "Estudo", "Tratamento médico", "Visita a familiares", "Outro"], ds160Section: "Travel" },
      { key: "trip_arrival_date", label: "Data prevista de chegada nos EUA", type: "date", required: true, ds160Section: "Travel" },
      { key: "trip_duration_days", label: "Duração prevista (dias)", type: "text", required: true, ds160Section: "Travel" },
      { key: "trip_us_address", label: "Endereço onde ficará nos EUA (hotel ou amigo)", type: "textarea", required: true, ds160Section: "Travel" },
      { key: "trip_paid_by", label: "Quem paga a viagem?", type: "select", required: true, options: ["Eu mesmo(a)", "Familiar", "Empresa", "Outro"], ds160Section: "Travel" },
      { key: "trip_payer_name", label: "Nome de quem paga", type: "text", ds160Section: "Travel", when: { field: "trip_paid_by", in: ["Familiar", "Empresa", "Outro"] } },
      { key: "trip_companions", label: "Companheiros de viagem (nome + parentesco)", type: "textarea", ds160Section: "Travel Companions" },
    ],
  },
  {
    key: "previous",
    title: "5. Viagens anteriores",
    fields: [
      { key: "us_been_before", label: "Já esteve nos EUA?", type: "yesno", required: true, ds160Section: "Previous U.S. Travel" },
      { key: "us_last_visit", label: "Última visita (data + duração)", type: "text", ds160Section: "Previous U.S. Travel", when: { field: "us_been_before", equals: "Sim" } },
      { key: "us_visa_before", label: "Já teve visto americano?", type: "yesno", required: true, ds160Section: "Previous U.S. Travel" },
      { key: "us_visa_number", label: "Número do visto anterior", type: "text", ds160Section: "Previous U.S. Travel", when: { field: "us_visa_before", equals: "Sim" } },
      { key: "us_visa_refused", label: "Já teve visto recusado por qualquer país?", type: "yesno", required: true, ds160Section: "Previous U.S. Travel" },
      { key: "us_visa_refused_details", label: "Detalhes da recusa", type: "textarea", ds160Section: "Previous U.S. Travel", when: { field: "us_visa_refused", equals: "Sim" } },
      { key: "us_entry_denied", label: "Já teve entrada negada nos EUA?", type: "yesno", required: true, ds160Section: "Previous U.S. Travel" },
      { key: "us_petition", label: "Há petição de imigração em seu nome?", type: "yesno", required: true, ds160Section: "Previous U.S. Travel" },
      { key: "other_countries", label: "Países visitados nos últimos 5 anos", type: "textarea", ds160Section: "Additional Work/Education/Training" },
    ],
  },
  {
    key: "family",
    title: "6. Família",
    fields: [
      { key: "father_name", label: "Nome do pai", type: "text", required: true, ds160Section: "Family Relatives" },
      { key: "father_birth_date", label: "Data de nascimento do pai", type: "date", ds160Section: "Family Relatives" },
      { key: "father_in_us", label: "Pai está nos EUA?", type: "yesno", required: true, ds160Section: "Family Relatives" },
      { key: "mother_name", label: "Nome da mãe", type: "text", required: true, ds160Section: "Family Relatives" },
      { key: "mother_birth_date", label: "Data de nascimento da mãe", type: "date", ds160Section: "Family Relatives" },
      { key: "mother_in_us", label: "Mãe está nos EUA?", type: "yesno", required: true, ds160Section: "Family Relatives" },
      { key: "spouse_name", label: "Nome do cônjuge", type: "text", ds160Section: "Family Spouse", when: { field: "marital_status", in: ["Casado(a)", "União estável"] } },
      { key: "spouse_birth_date", label: "Data de nascimento do cônjuge", type: "date", ds160Section: "Family Spouse", when: { field: "marital_status", in: ["Casado(a)", "União estável"] } },
      { key: "spouse_nationality", label: "Nacionalidade do cônjuge", type: "text", ds160Section: "Family Spouse", when: { field: "marital_status", in: ["Casado(a)", "União estável"] } },
      { key: "ex_spouse_name", label: "Nome do ex-cônjuge", type: "text", ds160Section: "Family Spouse", when: { field: "marital_status", equals: "Divorciado(a)" } },
      { key: "ex_marriage_date", label: "Data do casamento (com ex-cônjuge)", type: "date", ds160Section: "Family Spouse", when: { field: "marital_status", equals: "Divorciado(a)" } },
      { key: "ex_divorce_date", label: "Data do divórcio", type: "date", ds160Section: "Family Spouse", when: { field: "marital_status", equals: "Divorciado(a)" } },
      { key: "relatives_in_us", label: "Parentes próximos nos EUA (nome + parentesco + status)", type: "textarea", ds160Section: "Family Relatives" },
      { key: "us_contact", label: "Contato nos EUA (nome de pessoa ou hotel)", type: "text", required: true, ds160Section: "Family Relatives" },
    ],
  },
  {
    key: "work",
    title: "7. Trabalho & educação",
    fields: [
      { key: "occupation", label: "Ocupação atual", type: "text", required: true, ds160Section: "Present Work/Education" },
      { key: "employer_name", label: "Empresa/empregador", type: "text", required: true, ds160Section: "Present Work/Education" },
      { key: "employer_address", label: "Endereço da empresa", type: "textarea", required: true, ds160Section: "Present Work/Education" },
      { key: "employer_phone", label: "Telefone da empresa", type: "text", mask: "phone", ds160Section: "Present Work/Education" },
      { key: "admission_date", label: "Data de admissão", type: "date", ds160Section: "Present Work/Education" },
      { key: "salary_monthly", label: "Salário mensal (R$)", type: "text", required: true, ds160Section: "Present Work/Education" },
      { key: "job_description", label: "Descrição das atividades", type: "textarea", required: true, ds160Section: "Present Work/Education" },
      { key: "prev_employer", label: "Teve emprego anterior?", type: "yesno", ds160Section: "Previous Work/Education" },
      { key: "prev_employer_details", label: "Empregador anterior (nome + cargo + período)", type: "textarea", ds160Section: "Previous Work/Education", when: { field: "prev_employer", equals: "Sim" } },
      { key: "education_level", label: "Nível de escolaridade", type: "select", required: true, options: ["Ensino médio", "Técnico", "Superior", "Pós-graduação", "Mestrado", "Doutorado"], ds160Section: "Previous Work/Education" },
      { key: "education_institution", label: "Última instituição de ensino", type: "text", required: true, ds160Section: "Previous Work/Education" },
      { key: "education_course", label: "Curso / área de formação", type: "text", ds160Section: "Previous Work/Education" },
      { key: "education_city", label: "Cidade da instituição", type: "text", ds160Section: "Previous Work/Education" },
      { key: "education_start", label: "Início do curso (MM/AAAA)", type: "text", ds160Section: "Previous Work/Education" },
      { key: "education_end", label: "Fim do curso (MM/AAAA ou 'cursando')", type: "text", ds160Section: "Previous Work/Education" },
      { key: "postgrad", label: "Possui pós-graduação?", type: "yesno", ds160Section: "Previous Work/Education" },
      { key: "postgrad_details", label: "Detalhes da pós-graduação", type: "textarea", ds160Section: "Previous Work/Education", when: { field: "postgrad", equals: "Sim" } },
      { key: "languages", label: "Idiomas falados", type: "text", required: true, ds160Section: "Additional Work/Education/Training" },
      { key: "military_served", label: "Já serviu em forças armadas?", type: "yesno", ds160Section: "Additional Work/Education/Training" },
      { key: "military_details", label: "Detalhes do serviço militar", type: "textarea", ds160Section: "Additional Work/Education/Training", when: { field: "military_served", equals: "Sim" } },
    ],
  },
  {
    key: "security",
    title: "8. Segurança (perguntas obrigatórias)",
    hint: "Responda com sinceridade. Qualquer 'Sim' exige detalhamento e passa por revisão humana antes do envio oficial.",
    fields: [
      { key: "sec_disease", label: "Tem alguma doença contagiosa de relevância para saúde pública?", type: "yesno", required: true, flag: "review", ds160Section: "Security and Background" },
      { key: "sec_mental", label: "Tem transtorno mental ou físico que represente risco?", type: "yesno", required: true, flag: "review", ds160Section: "Security and Background" },
      { key: "sec_drugs", label: "É ou já foi usuário/dependente de drogas?", type: "yesno", required: true, flag: "review", ds160Section: "Security and Background" },
      { key: "sec_crime", label: "Já foi preso ou condenado por qualquer crime?", type: "yesno", required: true, flag: "review", ds160Section: "Security and Background" },
      { key: "sec_drug_traffic", label: "Esteve envolvido em tráfico de drogas?", type: "yesno", required: true, flag: "review", ds160Section: "Security and Background" },
      { key: "sec_terrorism", label: "Pretende ou já se envolveu em atividades terroristas ou de espionagem?", type: "yesno", required: true, flag: "review", ds160Section: "Security and Background" },
      { key: "sec_genocide", label: "Esteve envolvido em genocídio, tortura ou execuções extrajudiciais?", type: "yesno", required: true, flag: "review", ds160Section: "Security and Background" },
      { key: "sec_child_custody", label: "Reteve guarda de menor cidadão americano fora dos EUA?", type: "yesno", required: true, flag: "review", ds160Section: "Security and Background" },
      { key: "sec_overstay", label: "Já excedeu o prazo de permanência em visto americano?", type: "yesno", required: true, flag: "review", ds160Section: "Security and Background" },
      { key: "sec_notes", label: "Detalhamento (obrigatório se respondeu 'Sim' acima)", type: "textarea", ds160Section: "Security and Background" },
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
