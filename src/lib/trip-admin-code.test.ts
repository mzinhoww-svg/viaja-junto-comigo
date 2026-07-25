/**
 * Testes do módulo puro do código de acesso admin (VJT-011c): normalização,
 * leitura de `TRIP_ADMIN_CODE`, comparação e bloqueio por tentativas.
 */
import { describe, expect, it } from "vitest";
import {
  ADMIN_CODE_ATTEMPTS_ZERO,
  ADMIN_CODE_BLOCK_MS,
  ADMIN_CODE_MAX_FAILS,
  ADMIN_CODE_MIN_LENGTH,
  adminCodeBlockMinutesLeft,
  adminCodeEnabled,
  isAdminCodeBlocked,
  matchesAdminCode,
  normalizeAdminCode,
  parseAdminCodes,
  parseAdminEmail,
  registerAdminCodeFailure,
} from "./trip-admin-code";

const CODIGO = "VJT-AAAA-BBBB-CCCC";
const NORMALIZADO = "VJTAAAABBBBCCCC";

describe("normalizeAdminCode", () => {
  it("sobe para maiúsculas e descarta hífen/espaço", () => {
    expect(normalizeAdminCode("vjt-aaaa bbbb-cccc")).toBe(NORMALIZADO);
    expect(normalizeAdminCode(CODIGO)).toBe(NORMALIZADO);
    expect(normalizeAdminCode(NORMALIZADO)).toBe(NORMALIZADO);
  });
});

describe("parseAdminCodes", () => {
  it("sem variável de ambiente: lista vazia (recurso desligado)", () => {
    expect(parseAdminCodes(undefined)).toEqual([]);
    expect(parseAdminCodes(null)).toEqual([]);
    expect(parseAdminCodes("")).toEqual([]);
    expect(adminCodeEnabled(undefined)).toBe(false);
  });

  it("aceita vários códigos separados por vírgula (rotação)", () => {
    expect(parseAdminCodes(`${CODIGO}, VJT-DDDD-EEEE-FFFF`)).toEqual([
      NORMALIZADO,
      "VJTDDDDEEEEFFFF",
    ]);
    expect(adminCodeEnabled(CODIGO)).toBe(true);
  });

  it("descarta código curto demais em vez de aceitá-lo", () => {
    const curto = "A".repeat(ADMIN_CODE_MIN_LENGTH - 1);
    expect(parseAdminCodes(curto)).toEqual([]);
    expect(adminCodeEnabled(curto)).toBe(false);
    expect(parseAdminCodes(`${curto},${CODIGO}`)).toEqual([NORMALIZADO]);
  });
});

describe("matchesAdminCode", () => {
  const codes = parseAdminCodes(CODIGO);

  it("aceita o código certo em qualquer formatação", () => {
    expect(matchesAdminCode(CODIGO, codes)).toBe(true);
    expect(matchesAdminCode("vjt aaaa bbbb cccc", codes)).toBe(true);
    expect(matchesAdminCode(NORMALIZADO, codes)).toBe(true);
  });

  it("rejeita código errado, prefixo correto e string vazia", () => {
    expect(matchesAdminCode("VJT-AAAA-BBBB-CCCD", codes)).toBe(false);
    expect(matchesAdminCode("VJTAAAABBBBCCC", codes)).toBe(false);
    expect(matchesAdminCode("VJTAAAABBBBCCCCX", codes)).toBe(false);
    expect(matchesAdminCode("", codes)).toBe(false);
  });

  it("sem códigos configurados nada passa, nem string vazia", () => {
    expect(matchesAdminCode(CODIGO, [])).toBe(false);
    expect(matchesAdminCode("", [])).toBe(false);
  });

  it("com rotação, os dois códigos valem", () => {
    const dois = parseAdminCodes(`${CODIGO},VJT-DDDD-EEEE-FFFF`);
    expect(matchesAdminCode(CODIGO, dois)).toBe(true);
    expect(matchesAdminCode("VJT-DDDD-EEEE-FFFF", dois)).toBe(true);
  });
});

describe("bloqueio por tentativas", () => {
  const t0 = 1_700_000_000_000;

  it("conta falhas e bloqueia ao atingir o limite", () => {
    let estado = ADMIN_CODE_ATTEMPTS_ZERO;
    for (let i = 1; i < ADMIN_CODE_MAX_FAILS; i++) {
      estado = registerAdminCodeFailure(estado, t0);
      expect(estado.falhas).toBe(i);
      expect(isAdminCodeBlocked(estado, t0)).toBe(false);
    }

    estado = registerAdminCodeFailure(estado, t0);
    expect(isAdminCodeBlocked(estado, t0)).toBe(true);
    expect(estado.bloqueadoAte).toBe(t0 + ADMIN_CODE_BLOCK_MS);
  });

  it("bloqueio expira e o contador recomeça do zero", () => {
    let estado = ADMIN_CODE_ATTEMPTS_ZERO;
    for (let i = 0; i < ADMIN_CODE_MAX_FAILS; i++) {
      estado = registerAdminCodeFailure(estado, t0);
    }
    const depois = t0 + ADMIN_CODE_BLOCK_MS + 1;

    expect(isAdminCodeBlocked(estado, depois)).toBe(false);
    expect(registerAdminCodeFailure(estado, depois).falhas).toBe(1);
  });

  it("tentativa durante o bloqueio não estende o bloqueio", () => {
    let estado = ADMIN_CODE_ATTEMPTS_ZERO;
    for (let i = 0; i < ADMIN_CODE_MAX_FAILS; i++) {
      estado = registerAdminCodeFailure(estado, t0);
    }
    const durante = t0 + 60_000;

    expect(registerAdminCodeFailure(estado, durante)).toEqual(estado);
  });

  it("minutos restantes arredondam para cima e zeram fora do bloqueio", () => {
    const estado = { falhas: 0, bloqueadoAte: t0 + 90_000 };
    expect(adminCodeBlockMinutesLeft(estado, t0)).toBe(2);
    expect(adminCodeBlockMinutesLeft(estado, t0 + 90_001)).toBe(0);
    expect(adminCodeBlockMinutesLeft(ADMIN_CODE_ATTEMPTS_ZERO, t0)).toBe(0);
  });
});

describe("parseAdminEmail", () => {
  it("normaliza espaços e maiúsculas", () => {
    expect(parseAdminEmail("  Equipe@Viajaly.COM ")).toBe("equipe@viajaly.com");
  });

  it("sem e-mail válido devolve null (login da equipe desligado)", () => {
    expect(parseAdminEmail(undefined)).toBeNull();
    expect(parseAdminEmail("")).toBeNull();
    expect(parseAdminEmail("não-é-email")).toBeNull();
    expect(parseAdminEmail("sem@dominio")).toBeNull();
  });
});
