/**
 * Contrato de exclusão de conta (LGPD, VJT-017).
 *
 * `deleteOwnAccount` faz UMA chamada — `auth.admin.deleteUser()`. Tudo que
 * some, some por FK no Postgres. Ou seja: **a corretude da exclusão mora nas
 * migrations, não no TypeScript**, e é isso que este arquivo trava.
 *
 * Limitação declarada, mesma de `vjt017b-migration-consent-history.test.ts`:
 * este ambiente não tem Postgres (o daemon do Docker não sobe aqui), então o
 * que dá para verificar honestamente é o que as migrations DECLARAM.
 *
 * O estado real do banco de produção foi conferido em 2026-07-26 por consulta
 * ao catálogo (`pg_constraint.confdeltype`) via conector, e bate linha a linha
 * com o que este teste exige — em particular `savings_entries.created_by` =
 * SET NULL e as demais = CASCADE. Ver `reports/auditoria-estado-2026-07-26.md`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS = resolve(__dirname, "../../supabase/migrations");
const inicial = readFileSync(
  resolve(MIGRATIONS, "20260723120000_viajaly_trip_initial_schema.sql"),
  "utf-8",
);
const vjt017 = readFileSync(
  resolve(MIGRATIONS, "20260725200000_vjt017_lgpd_nps_account_deletion.sql"),
  "utf-8",
);

/** Normaliza espaço em branco para as asserções não dependerem de quebra de linha. */
const flat = (s: string) => s.replace(/\s+/g, " ");
const inicialFlat = flat(inicial);
const vjt017Flat = flat(vjt017);

describe("exclusão de conta — o que o cascade REMOVE", () => {
  it("a conta leva as viagens que ela criou (trips.owner_id cascade)", () => {
    // É esta FK que faz o conteúdo da viagem inteira ir junto: orçamento,
    // checklists, roteiro e economia penduram em `trips.id` com cascade.
    expect(inicialFlat).toMatch(
      /owner_id uuid not null references auth\.users\(id\) on delete cascade/,
    );
  });

  it.each([
    ["budget_categories", inicialFlat],
    ["budget_items", inicialFlat],
    ["checklists", inicialFlat],
    ["itinerary_days", inicialFlat],
    ["savings_entries", inicialFlat],
    ["trip_members", inicialFlat],
  ])("%s some junto com a trip (trip_id cascade)", (tabela, sql) => {
    const bloco = sql.match(new RegExp(`create table public\\.${tabela} \\((.*?)\\);`))?.[1];
    expect(bloco, `bloco de ${tabela} não encontrado`).toBeTruthy();
    expect(bloco!).toMatch(
      /trip_id uuid not null references public\.trips\(id\) on delete cascade/,
    );
  });

  it.each([
    ["ai_usage.user_id", /user_id uuid not null references auth\.users\(id\) on delete cascade/],
    [
      "entitlements.user_id",
      /user_id uuid primary key references auth\.users\(id\) on delete cascade/,
    ],
  ])("%s: dado pessoal direto some com a conta", (_rotulo, re) => {
    expect(inicialFlat).toMatch(re);
  });

  it("ai_conversations.created_by vira CASCADE — conversa com a IA é dado pessoal", () => {
    expect(vjt017Flat).toMatch(
      /add constraint ai_conversations_created_by_fkey foreign key \(created_by\) references auth\.users\(id\) on delete cascade/,
    );
  });

  it("trip_invites (created_by e accepted_by) viram CASCADE", () => {
    expect(vjt017Flat).toMatch(
      /add constraint trip_invites_created_by_fkey foreign key \(created_by\) references auth\.users\(id\) on delete cascade/,
    );
    expect(vjt017Flat).toMatch(
      /add constraint trip_invites_accepted_by_fkey foreign key \(accepted_by\) references auth\.users\(id\) on delete cascade/,
    );
  });

  it("trip_nps_responses.user_id nasce CASCADE", () => {
    expect(vjt017Flat).toMatch(
      /user_id uuid not null references auth\.users\(id\) on delete cascade/,
    );
  });

  it("user_lgpd_consents.user_id é CASCADE", () => {
    // A tabela nasce no VJT-017; o VJT-017b troca a PK mas não a FK.
    expect(vjt017Flat).toMatch(
      /user_id uuid primary key references auth\.users\(id\) on delete cascade/,
    );
  });
});

describe("exclusão de conta — o que SOBREVIVE, anonimizado", () => {
  it("savings_entries.created_by é SET NULL, não CASCADE", () => {
    // O caso que justifica o ticket: apagar quem registrou a economia não
    // pode apagar a economia da viagem de OUTRA pessoa. A linha continua,
    // sem apontar para ninguém.
    expect(vjt017Flat).toMatch(
      /add constraint savings_entries_created_by_fkey foreign key \(created_by\) references auth\.users\(id\) on delete set null/,
    );
    expect(vjt017Flat).not.toMatch(
      /add constraint savings_entries_created_by_fkey foreign key \(created_by\) references auth\.users\(id\) on delete cascade/,
    );
  });

  it("created_by aceita NULL — sem isso o SET NULL falharia em runtime", () => {
    // A coluna nasce `not null` no schema inicial; a migration precisa
    // derrubar isso ANTES de a FK poder anular. Se este drop sumir, a
    // exclusão passa a estourar violação de not-null no Postgres.
    expect(vjt017Flat).toMatch(
      /alter table public\.savings_entries alter column created_by drop not null/,
    );
    expect(inicialFlat).toMatch(
      /create table public\.savings_entries \(.*created_by uuid not null/,
    );
  });

  it("o valor guardado não é tocado pela FK — sobrevive intacto", () => {
    // `valor_brl_cents` é NOT NULL e não participa de nenhuma FK para
    // auth.users, então anonimizar `created_by` preserva o dado financeiro
    // da viagem compartilhada.
    const bloco = inicialFlat.match(/create table public\.savings_entries \((.*?)\);/)?.[1];
    expect(bloco).toBeTruthy();
    expect(bloco!).toMatch(/valor_brl_cents bigint not null/);
    expect(bloco!).not.toMatch(/valor_brl_cents[^,]*references/);
    expect(vjt017Flat).not.toMatch(/alter column valor_brl_cents/);
  });

  it("nenhuma outra coluna de savings_entries é alterada pela migration", () => {
    // Guarda contra alguém "aproveitar a migration" e anonimizar mais do que
    // o combinado — o registro precisa continuar utilizável para a trip.
    const alteracoes = vjt017Flat.match(/alter column \w+/g) ?? [];
    expect(alteracoes).toEqual(["alter column created_by"]);
  });
});
