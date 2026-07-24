/**
 * Lista curada de destinos populares para o passo "destino" do wizard (VJT-003).
 * Cada opção já carrega as variáveis de clonagem (regiao/clima/destino_pack).
 * O usuário pode digitar um destino livre em vez de escolher da lista — nesse
 * caso as variáveis ficam `null` e o motor de clonagem cai no catálogo geral.
 */

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
