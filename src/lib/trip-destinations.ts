/**
 * Lista curada de destinos populares para o passo "destino" do wizard (VJT-003).
 * Cada opção já carrega as variáveis de clonagem (regiao/clima/destino_pack).
 * O usuário pode digitar um destino livre em vez de escolher da lista — nesse
 * caso as variáveis ficam `null` e o motor de clonagem cai no catálogo geral.
 */

import type { TripVariables } from "./trip-templates";

export type TripDestinationOption = {
  id: string;
  label: string;
  pais: string;
  cidade: string | null;
  regiao: string;
  clima: string;
  destinoPack: string | null;
};

export const OUTRO_DESTINO_ID = "outro";

export const TRIP_DESTINATIONS: readonly TripDestinationOption[] = [
  {
    id: "orlando-us",
    label: "Orlando, Estados Unidos",
    pais: "Estados Unidos",
    cidade: "Orlando",
    regiao: "america_norte",
    clima: "quente",
    destinoPack: "orlando",
  },
  {
    id: "nyc-us",
    label: "Nova York, Estados Unidos",
    pais: "Estados Unidos",
    cidade: "Nova York",
    regiao: "america_norte",
    clima: "frio",
    destinoPack: null,
  },
  {
    id: "toronto-ca",
    label: "Toronto, Canadá",
    pais: "Canadá",
    cidade: "Toronto",
    regiao: "america_norte",
    clima: "frio",
    destinoPack: null,
  },
  {
    id: "cancun-mx",
    label: "Cancún, México",
    pais: "México",
    cidade: "Cancún",
    regiao: "america_norte",
    clima: "tropical",
    destinoPack: null,
  },
  {
    id: "paris-fr",
    label: "Paris, França",
    pais: "França",
    cidade: "Paris",
    regiao: "europa",
    clima: "frio",
    destinoPack: "europa",
  },
  {
    id: "roma-it",
    label: "Roma, Itália",
    pais: "Itália",
    cidade: "Roma",
    regiao: "europa",
    clima: "quente",
    destinoPack: "europa",
  },
  {
    id: "lisboa-pt",
    label: "Lisboa, Portugal",
    pais: "Portugal",
    cidade: "Lisboa",
    regiao: "europa",
    clima: "quente",
    destinoPack: "europa",
  },
  {
    id: "madri-es",
    label: "Madri, Espanha",
    pais: "Espanha",
    cidade: "Madri",
    regiao: "europa",
    clima: "quente",
    destinoPack: "europa",
  },
  {
    id: "londres-gb",
    label: "Londres, Reino Unido",
    pais: "Reino Unido",
    cidade: "Londres",
    regiao: "europa",
    clima: "frio",
    destinoPack: "europa",
  },
  {
    id: "tokyo-jp",
    label: "Tóquio, Japão",
    pais: "Japão",
    cidade: "Tóquio",
    regiao: "asia",
    clima: "tropical",
    destinoPack: null,
  },
  {
    id: "bangkok-th",
    label: "Bangkok, Tailândia",
    pais: "Tailândia",
    cidade: "Bangkok",
    regiao: "asia",
    clima: "tropical",
    destinoPack: null,
  },
  {
    id: "bsas-ar",
    label: "Buenos Aires, Argentina",
    pais: "Argentina",
    cidade: "Buenos Aires",
    regiao: "america_sul",
    clima: "frio",
    destinoPack: null,
  },
  {
    id: "santiago-cl",
    label: "Santiago, Chile",
    pais: "Chile",
    cidade: "Santiago",
    regiao: "america_sul",
    clima: "frio",
    destinoPack: null,
  },
] as const;

/** Comparação tolerante a caixa, acento e espaço em volta — "Cancún" == "cancun". */
function mesmoTexto(a: string | null, b: string | null): boolean {
  const normalizar = (valor: string | null) =>
    (valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  return normalizar(a) === normalizar(b);
}

/**
 * Reencontra a opção curada a partir do destino já persistido em `trips`
 * (`destino_pais`/`destino_cidade`). Casa por país **e** cidade: o par é o que
 * o wizard grava ao escolher da lista, e só ele identifica a opção sem
 * ambiguidade (ex. "Estados Unidos" sozinho não distingue Orlando — com pack —
 * de Nova York — sem pack). Destino digitado à mão não casa e devolve `null`,
 * que é o resultado correto: nesse caso a clonagem também rodou sem variáveis.
 */
export function findDestinationOption(
  pais: string,
  cidade: string | null,
): TripDestinationOption | null {
  return (
    TRIP_DESTINATIONS.find(
      (opcao) => mesmoTexto(opcao.pais, pais) && mesmoTexto(opcao.cidade, cidade),
    ) ?? null
  );
}

export type TripDestinoSalvo = {
  destinoPais: string;
  destinoCidade: string | null;
  numCriancas: number;
};

/**
 * Reconstrói as variáveis de clonagem de uma trip **já criada**, a partir do
 * que ficou salvo em `trips`. Contraparte de `tripVariablesFromInput`
 * (`trip-wizard.ts`), que faz o mesmo com o input do wizard antes da trip
 * existir: `trips` não persiste `regiao`/`clima`/`destino_pack` (o wizard só
 * as usa no momento da clonagem), então a única forma de recuperá-las é
 * reconsultar a mesma lista curada pelo destino salvo.
 *
 * `duracaoDias` fica `null` como na criação — o wizard não coleta duração,
 * então nenhum template é filtrado por `min_duracao` em nenhum dos dois lados.
 */
export function tripVariablesFromTrip(trip: TripDestinoSalvo): TripVariables {
  const opcao = findDestinationOption(trip.destinoPais, trip.destinoCidade);
  return {
    regiao: opcao?.regiao ?? null,
    clima: opcao?.clima ?? null,
    destinoPack: opcao?.destinoPack ?? null,
    comCriancas: trip.numCriancas > 0,
    duracaoDias: null,
  };
}
