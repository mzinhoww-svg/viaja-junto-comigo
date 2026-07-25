/**
 * Teste de contrato da migration do VJT-017b (issue #65). Mesma limitação já
 * documentada (VIAJALY-TRIP.md Seção 3): este ambiente não tem acesso ao
 * Postgres real do projeto, então o que dá para verificar honestamente é o
 * que a migration DECLARA — e, no caso deste ticket, o que ela declara é
 * exatamente o que estava errado antes:
 * - `user_id` deixa de ser PRIMARY KEY (era isso que impedia histórico);
 * - a tabela ganha PK própria, então cabe mais de uma linha por usuário;
 * - unique (user_id, versao_termos) mantém o log limpo e dá idempotência;
 * - nenhuma policy de UPDATE/DELETE é criada — append-only por RLS.
 *
 * O comportamento observável (usuário de versão antiga é re-apresentado ao
 * gate, aceite anterior preservado) é testado em `useLgpdConsent.test.tsx` e
 * `LgpdConsentGate.test.tsx`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LGPD_CONSENT_VERSION, LGPD_SUBPROCESSADORES, LGPD_CONSENT_TEXT } from "./lgpd-consent";

const MIGRATIONS_DIR = resolve(__dirname, "../../supabase/migrations");
const MIGRATION_017B = resolve(MIGRATIONS_DIR, "20260725220000_vjt017b_lgpd_consent_history.sql");
const MIGRATION_017 = resolve(
  MIGRATIONS_DIR,
  "20260725200000_vjt017_lgpd_nps_account_deletion.sql",
);

const sql = readFileSync(MIGRATION_017B, "utf-8");
const sql017 = readFileSync(MIGRATION_017, "utf-8");

describe("VJT-017b migration — consentimento vira log append-only", () => {
  it("roda depois do VJT-017 (ordem de aplicação pelo nome do arquivo)", () => {
    // As migrations são aplicadas em ordem lexicográfica do nome; a do
    // VJT-017b só faz sentido depois da que cria a tabela.
    expect(
      "20260725220000_vjt017b_lgpd_consent_history.sql" >
        "20260725200000_vjt017_lgpd_nps_account_deletion.sql",
    ).toBe(true);
    expect(sql017).toMatch(/create table public\.user_lgpd_consents/);
  });

  it("derruba a PK em user_id — a trava que impedia histórico", () => {
    expect(sql).toMatch(
      /alter table public\.user_lgpd_consents\s+drop constraint user_lgpd_consents_pkey;/,
    );
  });

  it("cria PK própria (id uuid), permitindo mais de uma linha por usuário", () => {
    expect(sql).toMatch(/add column id uuid not null default gen_random_uuid\(\)/);
    expect(sql).toMatch(/add constraint user_lgpd_consents_pkey primary key \(id\)/);
  });

  it("uma linha por (usuário, versão): unique + índice de leitura do gate", () => {
    expect(sql).toMatch(
      /add constraint user_lgpd_consents_user_versao_unique unique \(user_id, versao_termos\)/,
    );
    expect(sql).toMatch(
      /create index idx_user_lgpd_consents_user_aceito\s+on public\.user_lgpd_consents \(user_id, aceito_em desc\)/,
    );
  });

  it("versao_termos perde o default — a versão aceita é sempre explícita", () => {
    expect(sql).toMatch(/alter column versao_termos drop default/);
  });

  it("append-only: não cria policy de update nem de delete", () => {
    expect(sql).not.toMatch(/create policy[\s\S]*for update/i);
    expect(sql).not.toMatch(/create policy[\s\S]*for delete/i);
    // e as policies do VJT-017, que seguem valendo, também não têm
    expect(sql017).not.toMatch(
      /create policy lgpd_consent\w* on public\.user_lgpd_consents\s+for (update|delete)/i,
    );
  });

  it("não apaga consentimentos existentes (nada de delete/truncate na tabela)", () => {
    expect(sql).not.toMatch(/delete from public\.user_lgpd_consents/i);
    expect(sql).not.toMatch(/truncate/i);
    expect(sql).not.toMatch(/drop table/i);
  });
});

describe("VJT-017b — texto do consentimento", () => {
  it("a versão vigente é v2 (o bump é o que re-apresenta o gate a quem aceitou v1)", () => {
    expect(LGPD_CONSENT_VERSION).toBe("v2");
  });

  it("nomeia os subprocessadores de IA e a transferência internacional no próprio aceite", () => {
    expect(LGPD_CONSENT_TEXT).toMatch(/OpenRouter/);
    expect(LGPD_CONSENT_TEXT).toMatch(/DeepSeek/);
    expect(LGPD_CONSENT_TEXT).toMatch(/Estados Unidos/);
    expect(LGPD_CONSENT_TEXT).toMatch(/China/);
    expect(LGPD_CONSENT_TEXT).toMatch(/transferência internacional/i);
    expect(LGPD_CONSENT_TEXT).toMatch(/inteligência artificial/i);
  });

  it("a lista de subprocessadores cobre IA, hospedagem e pagamento, com país", () => {
    const nomes = LGPD_SUBPROCESSADORES.map((s) => s.nome);
    expect(nomes).toContain("OpenRouter");
    expect(nomes).toContain("DeepSeek");
    expect(nomes).toContain("Supabase");
    expect(nomes).toContain("Stripe");

    for (const sub of LGPD_SUBPROCESSADORES) {
      expect(sub.pais.length).toBeGreaterThan(0);
      expect(sub.papel.length).toBeGreaterThan(0);
    }
    expect(LGPD_SUBPROCESSADORES.find((s) => s.nome === "DeepSeek")?.pais).toBe("China");
    expect(LGPD_SUBPROCESSADORES.every((s) => s.transferenciaInternacional)).toBe(true);
  });
});

describe("VJT-017b — Política de Privacidade", () => {
  const privacidade = readFileSync(resolve(__dirname, "../routes/privacidade.tsx"), "utf-8");

  it("a seção Compartilhamento renderiza a MESMA lista do consentimento (sem texto paralelo)", () => {
    expect(privacidade).toMatch(/import \{ LGPD_SUBPROCESSADORES \} from "@\/lib\/lgpd-consent"/);
    expect(privacidade).toMatch(/LGPD_SUBPROCESSADORES\.map/);
    // a redação genérica antiga ("hospedagem, mensageria") não descrevia
    // inferência de IA e não pode voltar sozinha
    expect(privacidade).not.toMatch(/fornecedores essenciais \(hospedagem,\s*mensageria\)/);
  });

  it("descreve o tratamento por IA e a transferência internacional", () => {
    expect(privacidade).toMatch(/Tratamento por inteligência artificial/);
    expect(privacidade).toMatch(/Transferência internacional de dados/);
    expect(privacidade).toMatch(/OpenRouter/);
    expect(privacidade).toMatch(/DeepSeek/);
  });
});
