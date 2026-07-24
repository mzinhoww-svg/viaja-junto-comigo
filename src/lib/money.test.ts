import { describe, expect, it } from "vitest";
import { brlToCents, formatBRL } from "./money";

// NBSP-insensitive: Intl uses U+00A0 between "R$" and the amount.
const plain = (s: string) => s.replace(/\u00a0/g, " ");

describe("formatBRL", () => {
  it("formats cents as pt-BR currency", () => {
    expect(plain(formatBRL(123456))).toBe("R$ 1.234,56");
  });

  it("formats zero", () => {
    expect(plain(formatBRL(0))).toBe("R$ 0,00");
  });
});

describe("brlToCents", () => {
  it("parses a pt-BR currency string", () => {
    expect(brlToCents("R$ 1.234,56")).toBe(123456);
  });

  it("parses a bare decimal with comma", () => {
    expect(brlToCents("97,00")).toBe(9700);
  });

  it("returns 0 for non-numeric input", () => {
    expect(brlToCents("abc")).toBe(0);
  });
});
