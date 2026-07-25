// @vitest-environment jsdom
/**
 * Teste de TripMembersList (VJT-013): dono remove outro membro; membro comum
 * só pode sair; sozinho na trip não mostra a lista; kill switch INVITES_ENABLED.
 */
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TripMembersList } from "./TripMembersList";

const { useTripMembersMock, useCurrentUserIdMock, useRemoveTripMemberMock } = vi.hoisted(() => ({
  useTripMembersMock: vi.fn(),
  useCurrentUserIdMock: vi.fn(),
  useRemoveTripMemberMock: vi.fn(),
}));

vi.mock("@/hooks/useTripMembers", () => ({
  useTripMembers: useTripMembersMock,
  useCurrentUserId: useCurrentUserIdMock,
  useRemoveTripMember: useRemoveTripMemberMock,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const OWNER = { userId: "owner-1", role: "owner" as const, joinedAt: "2026-01-01T00:00:00Z" };
const EDITOR_A = { userId: "editor-a", role: "editor" as const, joinedAt: "2026-01-02T00:00:00Z" };
const EDITOR_B = { userId: "editor-b", role: "editor" as const, joinedAt: "2026-01-03T00:00:00Z" };

describe("TripMembersList", () => {
  it("sozinho na trip: não renderiza nada", () => {
    useTripMembersMock.mockReturnValue({ data: [OWNER], isLoading: false });
    useCurrentUserIdMock.mockReturnValue({ data: "owner-1" });
    useRemoveTripMemberMock.mockReturnValue({ mutate: vi.fn() });

    const { container } = render(<TripMembersList tripId="trip-1" />);
    expect(container.firstChild).toBeNull();
  });

  it("dono vê 'Remover' para os outros membros e confirma via AlertDialog", async () => {
    useTripMembersMock.mockReturnValue({ data: [OWNER, EDITOR_A, EDITOR_B], isLoading: false });
    useCurrentUserIdMock.mockReturnValue({ data: "owner-1" });
    const mutate = vi.fn();
    useRemoveTripMemberMock.mockReturnValue({ mutate });

    render(<TripMembersList tripId="trip-1" />);

    expect(screen.getByText(/Você · Dono/)).toBeTruthy();
    const removeButtons = screen.getAllByRole("button", { name: "Remover" });
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[0]);
    await waitFor(() => expect(screen.getByText("Remover este membro?")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Remover", hidden: false }));

    await waitFor(() => expect(mutate).toHaveBeenCalledWith("editor-a"));
  });

  it("membro comum não vê 'Remover' para outros, só 'Sair' para si mesmo", async () => {
    useTripMembersMock.mockReturnValue({ data: [OWNER, EDITOR_A, EDITOR_B], isLoading: false });
    useCurrentUserIdMock.mockReturnValue({ data: "editor-a" });
    const mutate = vi.fn();
    useRemoveTripMemberMock.mockReturnValue({ mutate });

    render(<TripMembersList tripId="trip-1" />);

    expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(screen.getByText("Sair desta viagem?")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Sair", hidden: false }));

    await waitFor(() => expect(mutate).toHaveBeenCalledWith("editor-a"));
  });

  it("INVITES_ENABLED=false: não renderiza nada", () => {
    vi.stubEnv("VITE_INVITES_ENABLED", "false");
    useTripMembersMock.mockReturnValue({ data: [OWNER, EDITOR_A], isLoading: false });
    useCurrentUserIdMock.mockReturnValue({ data: "owner-1" });
    useRemoveTripMemberMock.mockReturnValue({ mutate: vi.fn() });

    const { container } = render(<TripMembersList tripId="trip-1" />);
    expect(container.firstChild).toBeNull();
  });
});
