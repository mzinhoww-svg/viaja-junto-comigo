/**
 * Teste de contrato da migration do VJT-017 (`teste isso explicitamente`:
 * exclusão de conta remove dados de fato). Este ambiente não tem acesso a
 * um Postgres real do projeto (mesma limitação documentada em
 * VIAJALY-TRIP.md Seção 3 para as migrations anteriores), então o único
 * jeito honesto de testar o cascade sem um banco de verdade é verificar,
 * por contrato, que a migration declara `on delete cascade` exatamente
 * onde `supabase.auth.admin.deleteUser()` precisa dele para não falhar por
 * violação de FK — para qualquer membro (não só o owner da trip).
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

describe("VJT-017 migration — FKs para auth.users(id) precisam de ON DELETE CASCADE", () => {
  it("corrige as 4 colunas que faltavam cascade desde o schema inicial (VJT-001)", () => {
    expect(sql).toMatch(
      /alter table public\.savings_entries[\s\S]*?foreign key \(created_by\) references auth\.users\(id\) on delete cascade/,
    );
    expect(sql).toMatch(
      /alter table public\.ai_conversations[\s\S]*?foreign key \(created_by\) references auth\.users\(id\) on delete cascade/,
    );
    expect(sql).toMatch(
      /alter table public\.trip_invites[\s\S]*?foreign key \(created_by\) references auth\.users\(id\) on delete cascade/,
    );
    expect(sql).toMatch(
      /alter table public\.trip_invites[\s\S]*?foreign key \(accepted_by\) references auth\.users\(id\) on delete cascade/,
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

  it("as 4 colunas corrigidas não têm mais uma FK sem cascade sobrando na migration", () => {
    // Regressão: garante que a correção não deixou uma segunda declaração
    // da mesma FK sem "on delete cascade" (ex.: copiar/colar incompleto).
    const dropsSemCascade = [
      /add constraint savings_entries_created_by_fkey\s+foreign key \(created_by\) references auth\.users\(id\);/,
      /add constraint ai_conversations_created_by_fkey\s+foreign key \(created_by\) references auth\.users\(id\);/,
      /add constraint trip_invites_created_by_fkey\s+foreign key \(created_by\) references auth\.users\(id\);/,
      /add constraint trip_invites_accepted_by_fkey\s+foreign key \(accepted_by\) references auth\.users\(id\);/,
    ];
    for (const semCascade of dropsSemCascade) {
      expect(sql).not.toMatch(semCascade);
    }
  });
});
