// @vitest-environment jsdom
/**
 * Tela da viagem exemplo (VJT-020). Os hooks de dados são mockados — a
 * aritmética já tem cobertura em `trip-template.test.ts` e a garantia de RLS
 * é medida por `scripts/test-rls.sh --audit`. O que se prova aqui é o que só
 * a tela pode errar: que ela é somente leitura, que o aviso de exemplo não
 * some, e que o CTA leva ao lugar certo em cada estado do visitante.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateTripView } from "./TemplateTripView";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider } from "@/hooks/usePaywall";
import { PAYWALL_COPY } from "@/lib/entitlements";
import { templateCloneNext, type TemplateTrip } from "@/lib/trip-template";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useEntitlement: vi.fn(),
  useOwnedTripCount: vi.fn(),
  useTemplateTrip: vi.fn(),
  useMyTemplateClone: vi.fn(),
  cloneMutate: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/hooks/useEntitlement", () => ({ useEntitlement: mocks.useEntitlement }));
vi.mock("@/hooks/useOwnedTripCount", () => ({
  useOwnedTripCount: mocks.useOwnedTripCount,
  ownedTripCountQueryKey: () => ["trip", "owned-count"],
}));
vi.mock("@/hooks/useTemplateTrip", () => ({
  useTemplateTrip: mocks.useTemplateTrip,
  useMyTemplateClone: mocks.useMyTemplateClone,
  useCloneTemplateTrip: () => ({ mutate: mocks.cloneMutate, isPending: false }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));

const TRIP: TemplateTrip = {
  id: "tpl-1",
  nome: "Expedição Orlando em Família",
  destinoPais: "Estados Unidos",
  destinoCidade: "Orlando",
  dataViagem: "2027-07-15",
  numPessoas: 4,
  numCriancas: 2,
  moedaDestino: "USD",
  cambioManual: 5,
  categorias: [
    {
      id: "cat-1",
      nome: "Parques",
      cor: "#0EA5E9",
      ordem: 0,
      itens: [
        {
          id: "bi-1",
          nome: "Ingressos Disney",
          estimadoBrlCents: 900_00,
          estimadoDestinoCents: null,
          pagoBrlCents: 0,
          pagoDestinoCents: 0,
        },
      ],
    },
  ],
  checklists: [
    {
      id: "cl-1",
      tipo: "documentos",
      nome: "Documentos",
      ordem: 0,
      itens: [{ id: "i-1", titulo: "Passaporte válido", done: true, marco: 90, ordem: 0 }],
    },
  ],
  dias: [
    {
      id: "d-1",
      diaNumero: 1,
      ordem: 0,
      data: "2027-07-15",
      slots: [
        {
          id: "s-1",
          periodo: "manha",
          ondeIr: "Magic Kingdom",
          ondeComer: null,
          observacoes: null,
        },
      ],
    },
  ],
  savingsTotalBrlCents: 100_00,
};

function renderView(clonarAoEntrar = false) {
  return render(
    <PaywallProvider>
      <TemplateTripView slug="orlando" clonarAoEntrar={clonarAoEntrar} />
      <PaywallModal />
    </PaywallProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useTemplateTrip.mockReturnValue({ data: TRIP, isLoading: false });
  mocks.useMyTemplateClone.mockReturnValue({ data: null, isLoading: false });
  mocks.useAuth.mockReturnValue({ loading: false, user: null, role: null, agencyId: null });
  mocks.useEntitlement.mockReturnValue({
    tier: "free",
    origem: null,
    isPremium: false,
    isLoading: false,
  });
  mocks.useOwnedTripCount.mockReturnValue({ data: 0, isLoading: false });
});

afterEach(cleanup);

describe("TemplateTripView — leitura pública", () => {
  it("mostra o aviso de exemplo e o conteúdo da viagem", () => {
    renderView();
    expect(screen.getByText("Você está vendo um exemplo")).toBeTruthy();
    expect(screen.getByText("Expedição Orlando em Família")).toBeTruthy();
    expect(screen.getByText("Ingressos Disney")).toBeTruthy();
    expect(screen.getByText("Magic Kingdom")).toBeTruthy();
  });

  it("não renderiza bottom nav nem nenhum controle de edição", () => {
    const { container } = renderView();
    expect(container.querySelectorAll("nav")).toHaveLength(0);
    expect(container.querySelectorAll("input, textarea")).toHaveLength(0);
    // O único botão da tela é o CTA (os demais são os gatilhos de colapso,
    // que não escrevem nada). Nenhum deles pode ser de remover/duplicar.
    expect(screen.queryByRole("button", { name: /remover|excluir|duplicar|salvar/i })).toBeNull();
  });

  it("sem viagem template, a página mostra estado vazio em vez de quebrar", () => {
    mocks.useTemplateTrip.mockReturnValue({ data: null, isLoading: false });
    renderView();
    expect(screen.getByText("Nenhum exemplo disponível")).toBeTruthy();
  });
});

describe("TemplateTripView — CTA", () => {
  it("visitante deslogado é mandado ao login com a volta para o exemplo", () => {
    const href = vi.fn();
    Object.defineProperty(window, "location", {
      value: {
        set href(v: string) {
          href(v);
        },
      },
      writable: true,
    });

    renderView();
    fireEvent.click(
      screen.getByRole("button", { name: /criar minha viagem a partir deste exemplo/i }),
    );

    expect(href).toHaveBeenCalledWith(
      `/trip/login?next=${encodeURIComponent(templateCloneNext("orlando"))}`,
    );
  });

  it("usuário logado sem viagem dispara a clonagem", () => {
    mocks.useAuth.mockReturnValue({
      loading: false,
      user: { id: "u-1" },
      role: null,
      agencyId: null,
    });
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /criar minha viagem/i }));
    expect(mocks.cloneMutate).toHaveBeenCalledWith("tpl-1", expect.anything());
  });

  it("free que já tem outra viagem abre o paywall de segunda viagem, sem clonar", async () => {
    mocks.useAuth.mockReturnValue({
      loading: false,
      user: { id: "u-1" },
      role: null,
      agencyId: null,
    });
    mocks.useOwnedTripCount.mockReturnValue({ data: 1, isLoading: false });
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /criar minha viagem/i }));

    await waitFor(() => {
      expect(screen.getByText(PAYWALL_COPY.segunda_viagem.titulo)).toBeTruthy();
    });
    expect(mocks.cloneMutate).not.toHaveBeenCalled();
  });

  it("quem já clonou vê 'abrir minha viagem' e vai para o app, sem clonar de novo", () => {
    mocks.useAuth.mockReturnValue({
      loading: false,
      user: { id: "u-1" },
      role: null,
      agencyId: null,
    });
    mocks.useMyTemplateClone.mockReturnValue({ data: "trip-9", isLoading: false });
    mocks.useOwnedTripCount.mockReturnValue({ data: 1, isLoading: false });
    renderView();

    fireEvent.click(screen.getByRole("button", { name: /abrir minha viagem/i }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/trip" });
    expect(mocks.cloneMutate).not.toHaveBeenCalled();
  });

  it("volta do login com ?clonar=sim clona sozinho, uma vez só", async () => {
    mocks.useAuth.mockReturnValue({
      loading: false,
      user: { id: "u-1" },
      role: null,
      agencyId: null,
    });
    const { rerender } = renderView(true);

    await waitFor(() => expect(mocks.cloneMutate).toHaveBeenCalledTimes(1));

    rerender(
      <PaywallProvider>
        <TemplateTripView slug="orlando" clonarAoEntrar={true} />
        <PaywallModal />
      </PaywallProvider>,
    );
    await waitFor(() => expect(mocks.cloneMutate).toHaveBeenCalledTimes(1));
  });

  it("volta do login com ?clonar=sim NÃO clona se o plano não permite", async () => {
    mocks.useAuth.mockReturnValue({
      loading: false,
      user: { id: "u-1" },
      role: null,
      agencyId: null,
    });
    mocks.useOwnedTripCount.mockReturnValue({ data: 1, isLoading: false });
    renderView(true);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /criar minha viagem/i })).toBeTruthy();
    });
    expect(mocks.cloneMutate).not.toHaveBeenCalled();
  });
});
