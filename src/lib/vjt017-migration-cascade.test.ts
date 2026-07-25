/**
 * Teste de contrato da migration do VJT-017 (`teste isso explicitamente`:
 * exclusão de conta remove dados de fato). Este ambiente não tem acesso a
 * um Postgres real do projeto (mesma limitação documentada em
 * VIAJALY-TRIP.md Seção 3 para as migrations anteriores), então o único
 * jeito honesto de testar o cascade sem um banco de verdade é verificar,
 * por contrato, que a migration declara a ação de FK certa em cada coluna
 * — para qualquer membro (não só o owner da trip):
 * - CASCADE (apaga a linha) para dado genuinamente pessoal e sem agregado
 *   compartilhado: `ai_conversations`, `trip_invites`, `trip_nps_responses`.
 * - SET NULL (anonimiza, preserva a linha) só para `savings_entries.created_by`
 *   — o valor consolida na economia coletiva da trip (`calcularAcumulado`,
 *   somado de todos os membros sem filtro por autor); apagar a linha
 *   distorceria o total que os outros membros veem. Uma vez `created_by`
 *   nulo, a linha deixa de identificar alguém (LGPD Art. 12) — o
 *   apagamento do dado pessoal (Art. 18) já está satisfeito sem destruir o
 *   valor financeiro que passou a ser coletivo.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260725200000_vjt017_lgpd_nps_account_deletion.sql",
);

const sql = readFileSync(MIGRATION_PATH, "utf-8");

/** Extrai o corpo do `create table` (até o `);` que fecha a definição). */
function tableBody(nomeTabela: string): string {
  const inicio = sql.indexOf(`create table public.${nomeTabela} (`);
  if (inicio === -1) throw new Error(`tabela ${nomeTabela} não encontrada na migration`);
  const fim = sql.indexOf(");", inicio);
  return sql.slice(inicio, fim);
}

/**
 * Extrai UM statement `alter table public.<tabela> ...;` a partir da
 * ocorrência de `marcador` dentro dele (ex.: o nome da constraint), até o
 * `;` que o fecha — sem isso, um regex não-guloso (`[\s\S]*?`) atravessa
 * para o próximo `alter table`/`create table` do arquivo e pode casar com
 * uma FK de OUTRA tabela mais adiante (bug já pego neste arquivo: a regex
 * de "não ficou como CASCADE" para savings_entries batia com o cascade de
 * ai_conversations/trip_invites, que vem depois no arquivo).
 */
function alterStatement(nomeTabela: string, marcador: string): string {
  const marcadorPos = sql.indexOf(marcador);
  if (marcadorPos === -1) throw new Error(`marcador "${marcador}" não encontrado na migration`);
  const inicio = sql.lastIndexOf(`alter table public.${nomeTabela}`, marcadorPos);
  if (inicio === -1)
    throw new Error(`alter table de ${nomeTabela} não encontrado antes do marcador`);
  const fim = sql.indexOf(";", marcadorPos);
  return sql.slice(inicio, fim + 1);
}

describe("VJT-017 migration — FKs para auth.users(id) corrigidas com a ação certa", () => {
  it("savings_entries.created_by usa SET NULL (anonimiza, preserva o valor coletivo) e a coluna aceita NULL", () => {
    const stmt = alterStatement("savings_entries", "savings_entries_created_by_fkey");
    expect(stmt).toMatch(/alter column created_by drop not null/);
    expect(stmt).toMatch(
      /foreign key \(created_by\) references auth\.users\(id\) on delete set null/,
    );
    // Regressão: não pode ter regredido para cascade (nem sobrado sem ação).
    expect(stmt).not.toMatch(/on delete cascade/);
    expect(stmt).not.toMatch(/references auth\.users\(id\);/);
  });

  it("ai_conversations.created_by usa CASCADE (dado pessoal sem agregado compartilhado)", () => {
    const stmt = alterStatement("ai_conversations", "ai_conversations_created_by_fkey");
    expect(stmt).toMatch(
      /foreign key \(created_by\) references auth\.users\(id\) on delete cascade/,
    );
  });

  it("trip_invites.created_by e accepted_by usam CASCADE (dado pessoal sem agregado compartilhado)", () => {
    const created = alterStatement("trip_invites", "trip_invites_created_by_fkey");
    expect(created).toMatch(
      /foreign key \(created_by\) references auth\.users\(id\) on delete cascade/,
    );
    const accepted = alterStatement("trip_invites", "trip_invites_accepted_by_fkey");
    expect(accepted).toMatch(
      /foreign key \(accepted_by\) references auth\.users\(id\) on delete cascade/,
    );
  });

  it("trip_nps_responses referencia trips e auth.users com cascade", () => {
    const body = tableBody("trip_nps_responses");
    expect(body).toMatch(/trip_id uuid not null references public\.trips\(id\) on delete cascade/);
    expect(body).toMatch(/user_id uuid not null references auth\.users\(id\) on delete cascade/);
  });

  it("user_lgpd_consents referencia auth.users com cascade", () => {
    const body = tableBody("user_lgpd_consents");
    expect(body).toMatch(/user_id uuid primary key references auth\.users\(id\) on delete cascade/);
  });

  it("as 4 colunas corrigidas não têm mais uma FK sem ação sobrando na migration", () => {
    // Regressão: garante que a correção não deixou uma segunda declaração
    // da mesma FK sem ação explícita (ex.: copiar/colar incompleto).
    const semAcao = [
      /add constraint savings_entries_created_by_fkey\s+foreign key \(created_by\) references auth\.users\(id\);/,
      /add constraint ai_conversations_created_by_fkey\s+foreign key \(created_by\) references auth\.users\(id\);/,
      /add constraint trip_invites_created_by_fkey\s+foreign key \(created_by\) references auth\.users\(id\);/,
      /add constraint trip_invites_accepted_by_fkey\s+foreign key \(accepted_by\) references auth\.users\(id\);/,
    ];
    for (const s of semAcao) {
      expect(sql).not.toMatch(s);
    }
  });
});
