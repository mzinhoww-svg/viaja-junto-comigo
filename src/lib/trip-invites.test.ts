import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTripInviteLink, invitesEnabled, isInviteExpired } from "./trip-invites";

describe("buildTripInviteLink", () => {
  it("monta o link com o token e a origem informada", () => {
    expect(buildTripInviteLink("abc123", "https://app.viajaly.com")).toBe(
      "https://app.viajaly.com/trip/aceitar-convite?token=abc123",
    );
  });
});

describe("isInviteExpired", () => {
  it("expirado quando expires_at <= agora", () => {
    expect(isInviteExpired("2026-07-01T00:00:00Z", "2026-07-25T00:00:00Z")).toBe(true);
  });

  it("não expirado quando expires_at > agora", () => {
    expect(isInviteExpired("2026-08-01T00:00:00Z", "2026-07-25T00:00:00Z")).toBe(false);
  });
});

describe("invitesEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("true por padrão (sem a env var)", () => {
    vi.stubEnv("VITE_INVITES_ENABLED", undefined as unknown as string);
    expect(invitesEnabled()).toBe(true);
  });

  it("false só quando explicitamente 'false'", () => {
    vi.stubEnv("VITE_INVITES_ENABLED", "false");
    expect(invitesEnabled()).toBe(false);
  });

  it("qualquer outro valor mantém habilitado", () => {
    vi.stubEnv("VITE_INVITES_ENABLED", "true");
    expect(invitesEnabled()).toBe(true);
  });
});
