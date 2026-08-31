"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createClient } from "../../lib/supabase/client";

type SearchMode = "simple" | "advanced";
type ViewMode = "images" | "compact";
type SortMode =
  | "name"
  | "released"
  | "mv"
  | "price_desc"
  | "price_asc";
type CompareOperator = "eq" | "neq" | "lt" | "lte" | "gt" | "gte";
type ColorMatchMode = "include" | "exact" | "at_most";

type CardRow = {
  scryfall_id: string;
  oracle_id: string | null;
  name: string;
  type_line: string | null;
  color_identity: unknown;
  image_uri: string | null;
  image_uri_large: string | null;
  card_data: unknown;
};

type CardItem = CardRow & {
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  oracle_text: string;
  mana_cost: string;
  mana_value: number | null;
  artist: string;
  flavor_text: string;
  language: string;
  released_at: string;
  usd_price: number | null;
};

type AdvancedForm = {
  name: string;
  text: string;
  type: string;

  colors: string[];
  colorMode: ColorMatchMode;
  colorless: boolean;

  identity: string[];
  identityMode: ColorMatchMode;
  identityColorless: boolean;

  manaCost: string;
  manaValueOperator: CompareOperator;
  manaValue: string;

  games: string[];

  set: string;
  rarities: string[];

  legalityFormat: string;
  legalityStatus: string;

  priceOperator: CompareOperator;
  price: string;

  artist: string;
  flavor: string;
  language: string;

  sort: SortMode;
  view: ViewMode;
};

const initialAdvancedForm: AdvancedForm = {
  name: "",
  text: "",
  type: "",

  colors: [],
  colorMode: "include",
  colorless: false,

  identity: [],
  identityMode: "include",
  identityColorless: false,

  manaCost: "",
  manaValueOperator: "eq",
  manaValue: "",

  games: ["paper"],

  set: "",
  rarities: [],

  legalityFormat: "",
  legalityStatus: "legal",

  priceOperator: "lt",
  price: "",

  artist: "",
  flavor: "",
  language: "default",

  sort: "name",
  view: "images",
};

const colorOptions = [
  { value: "W", label: "Branco", symbol: "W" },
  { value: "U", label: "Azul", symbol: "U" },
  { value: "B", label: "Preto", symbol: "B" },
  { value: "R", label: "Vermelho", symbol: "R" },
  { value: "G", label: "Verde", symbol: "G" },
] as const;

const rarityOptions = [
  { value: "common", label: "Comum" },
  { value: "uncommon", label: "Incomum" },
  { value: "rare", label: "Rara" },
  { value: "mythic", label: "Mítica" },
];

const gameOptions = [
  { value: "paper", label: "Paper" },
  { value: "arena", label: "Arena" },
  { value: "mtgo", label: "Magic Online" },
];

const formatOptions = [
  ["standard", "Standard"],
  ["future", "Future"],
  ["historic", "Historic"],
  ["timeless", "Timeless"],
  ["gladiator", "Gladiator"],
  ["pioneer", "Pioneer"],
  ["explorer", "Explorer"],
  ["modern", "Modern"],
  ["legacy", "Legacy"],
  ["pauper", "Pauper"],
  ["vintage", "Vintage"],
  ["penny", "Penny"],
  ["commander", "Commander"],
  ["oathbreaker", "Oathbreaker"],
  ["standardbrawl", "Standard Brawl"],
  ["brawl", "Brawl"],
  ["alchemy", "Alchemy"],
  ["paupercommander", "Pauper Commander"],
  ["duel", "Duel Commander"],
  ["oldschool", "Old School"],
  ["premodern", "Premodern"],
  ["predh", "PreDH"],
] as const;

const legalityOptions = [
  ["legal", "Legal"],
  ["not_legal", "Não legal"],
  ["restricted", "Restrita"],
  ["banned", "Banida"],
] as const;

const languageOptions = [
  ["default", "Padrão"],
  ["en", "Inglês"],
  ["pt", "Português"],
  ["es", "Espanhol"],
  ["fr", "Francês"],
  ["de", "Alemão"],
  ["it", "Italiano"],
  ["ja", "Japonês"],
  ["ko", "Coreano"],
  ["ru", "Russo"],
  ["zhs", "Chinês simplificado"],
  ["zht", "Chinês tradicional"],
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function stringValue(
  record: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  return typeof record[key] === "string"
    ? (record[key] as string)
    : fallback;
}

function numberValue(
  record: Record<string, unknown>,
  key: string
) {
  const value = record[key];

  if (typeof value === "number") return value;

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function nestedRecord(
  record: Record<string, unknown>,
  key: string
) {
  return asRecord(record[key]);
}

function parseCard(row: CardRow): CardItem {
  const data = asRecord(row.card_data);
  const prices = nestedRecord(data, "prices");

  return {
    ...row,
    set: stringValue(data, "set", "—").toUpperCase(),
    set_name: stringValue(data, "set_name", "Edição desconhecida"),
    collector_number: stringValue(data, "collector_number", "—"),
    rarity: stringValue(data, "rarity", "unknown"),
    oracle_text: stringValue(data, "oracle_text", ""),
    mana_cost: stringValue(data, "mana_cost", ""),
    mana_value: numberValue(data, "cmc"),
    artist: stringValue(data, "artist", ""),
    flavor_text: stringValue(data, "flavor_text", ""),
    language: stringValue(data, "lang", "en"),
    released_at: stringValue(data, "released_at", ""),
    usd_price: numberValue(prices, "usd"),
  };
}

function proxiedImage(url: string | null) {
  if (!url) return null;
  return `/api/scryfall/image?url=${encodeURIComponent(url)}`;
}

function toggleArrayValue(
  current: string[],
  value: string
) {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

function rarityLabel(value: string) {
  return (
    rarityOptions.find((item) => item.value === value)?.label ??
    value
  );
}

function formatUsd(value: number | null) {
  if (value === null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function CardsCatalogPage() {
  const [supabase] = useState(() => createClient());

  const [searchMode, setSearchMode] =
    useState<SearchMode>("simple");

  const [simpleSearch, setSimpleSearch] = useState("");
  const [simpleColorFilter, setSimpleColorFilter] =
    useState("Todas");
  const [simpleTypeFilter, setSimpleTypeFilter] =
    useState("Todos");

  const [advanced, setAdvanced] =
    useState<AdvancedForm>(initialAdvancedForm);

  const [results, setResults] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCard, setSelectedCard] =
    useState<CardItem | null>(null);

  const [resultView, setResultView] =
    useState<ViewMode>("images");

  useEffect(() => {
    if (searchMode !== "simple") return;

    const query = simpleSearch.trim();

    if (query.length < 2) {
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("cards")
        .select(
          "scryfall_id, oracle_id, name, type_line, color_identity, image_uri, image_uri_large, card_data"
        )
        .ilike("name", `%${query}%`)
        .limit(80);

      if (cancelled) return;

      if (error) {
        console.error("Erro ao procurar cartas:", error);
        setErrorMessage("Não foi possível pesquisar as cartas.");
        setLoading(false);
        return;
      }

      const normalized = ((data ?? []) as CardRow[])
        .map(parseCard)
        .sort((a, b) => {
          const q = query.toLocaleLowerCase("pt-BR");

          const aStarts = a.name
            .toLocaleLowerCase("pt-BR")
            .startsWith(q);

          const bStarts = b.name
            .toLocaleLowerCase("pt-BR")
            .startsWith(q);

          if (aStarts !== bStarts) {
            return aStarts ? -1 : 1;
          }

          return a.name.localeCompare(b.name, "pt-BR");
        });

      setResults(normalized);
      setResultView("images");
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchMode, simpleSearch, supabase]);

  const simpleVisibleCards = useMemo(() => {
    if (searchMode !== "simple") return results;

    return results.filter((card) => {
      const identity = Array.isArray(card.color_identity)
        ? card.color_identity.filter(
            (item): item is string =>
              typeof item === "string"
          )
        : [];

      if (simpleColorFilter !== "Todas") {
        if (simpleColorFilter === "C") {
          if (identity.length !== 0) return false;
        } else if (!identity.includes(simpleColorFilter)) {
          return false;
        }
      }

      if (simpleTypeFilter !== "Todos") {
        const typeLine = (card.type_line ?? "")
          .toLocaleLowerCase("pt-BR");

        const matches =
          simpleTypeFilter === "Criatura"
            ? typeLine.includes("creature")
            : simpleTypeFilter === "Artefato"
              ? typeLine.includes("artifact")
              : simpleTypeFilter === "Encantamento"
                ? typeLine.includes("enchantment")
                : simpleTypeFilter === "Planeswalker"
                  ? typeLine.includes("planeswalker")
                  : simpleTypeFilter === "Instantânea"
                    ? typeLine.includes("instant")
                    : simpleTypeFilter === "Feitiço"
                      ? typeLine.includes("sorcery")
                      : simpleTypeFilter === "Terreno"
                        ? typeLine.includes("land")
                        : true;

        if (!matches) return false;
      }

      return true;
    });
  }, [
    results,
    searchMode,
    simpleColorFilter,
    simpleTypeFilter,
  ]);

  const visibleCards =
    searchMode === "simple" ? simpleVisibleCards : results;

  function updateSimpleSearch(value: string) {
    setSimpleSearch(value);

    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setErrorMessage("");
    }
  }

  function switchMode(mode: SearchMode) {
    setSearchMode(mode);
    setResults([]);
    setErrorMessage("");
    setLoading(false);

    if (mode === "advanced") {
      setResultView(advanced.view);
    } else {
      setResultView("images");
    }
  }

  function updateAdvanced<K extends keyof AdvancedForm>(
    key: K,
    value: AdvancedForm[K]
  ) {
    setAdvanced((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleAdvancedColor(
    key: "colors" | "identity",
    colorlessKey: "colorless" | "identityColorless",
    color: string
  ) {
    setAdvanced((current) => ({
      ...current,
      [key]: toggleArrayValue(current[key] as string[], color),
      [colorlessKey]: false,
    }));
  }

  function toggleColorless(
    key: "colors" | "identity",
    colorlessKey: "colorless" | "identityColorless"
  ) {
    setAdvanced((current) => {
      const next = !current[colorlessKey];

      return {
        ...current,
        [colorlessKey]: next,
        [key]: next ? [] : current[key],
      };
    });
  }

  async function runAdvancedSearch(
    event?: FormEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const manaValue =
      advanced.manaValue.trim() === ""
        ? null
        : Number(advanced.manaValue);

    const price =
      advanced.price.trim() === ""
        ? null
        : Number(advanced.price);

    const { data, error } = await supabase.rpc(
      "search_cards_advanced",
      {
        p_name: advanced.name.trim() || null,
        p_text: advanced.text.trim() || null,
        p_type: advanced.type.trim() || null,

        p_colors:
          advanced.colors.length > 0
            ? advanced.colors
            : null,
        p_color_mode: advanced.colorMode,
        p_colorless: advanced.colorless,

        p_identity:
          advanced.identity.length > 0
            ? advanced.identity
            : null,
        p_identity_mode: advanced.identityMode,
        p_identity_colorless: advanced.identityColorless,

        p_mana_cost:
          advanced.manaCost.trim() || null,
        p_mv_operator: advanced.manaValueOperator,
        p_mv:
          Number.isFinite(manaValue) ? manaValue : null,

        p_games:
          advanced.games.length > 0
            ? advanced.games
            : null,

        p_set: advanced.set.trim() || null,
        p_rarities:
          advanced.rarities.length > 0
            ? advanced.rarities
            : null,

        p_legality_format:
          advanced.legalityFormat || null,
        p_legality_status:
          advanced.legalityFormat
            ? advanced.legalityStatus
            : null,

        p_price_operator: advanced.priceOperator,
        p_price: Number.isFinite(price) ? price : null,

        p_artist: advanced.artist.trim() || null,
        p_flavor: advanced.flavor.trim() || null,
        p_language:
          advanced.language === "default"
            ? null
            : advanced.language,

        p_sort: advanced.sort,
        p_limit: 160,
      }
    );

    if (error) {
      console.error("Erro na busca avançada:", error);

      setErrorMessage(
        error.message.includes("search_cards_advanced")
          ? "A busca avançada ainda não está instalada. Rode o SQL que acompanha esta página."
          : `Não foi possível executar a busca avançada: ${error.message}`
      );

      setResults([]);
      setLoading(false);
      return;
    }

    setResults(((data ?? []) as CardRow[]).map(parseCard));
    setResultView(advanced.view);
    setLoading(false);
  }

  function clearAdvanced() {
    setAdvanced(initialAdvancedForm);
    setResults([]);
    setErrorMessage("");
    setResultView("images");
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-5 py-10 text-[#f4f1e8] md:px-10">
      <div className="mx-auto w-full max-w-7xl">
        <Link
          href="/"
          className="text-sm text-white/35 transition hover:text-white"
        >
          ← CurveOut
        </Link>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-[#c8b27a]/55">
              Catálogo
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
              Cartas
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/35">
              Pesquise o catálogo de Magic usando a base local do
              CurveOut.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-white/10 bg-[#101013] p-1">
            <button
              type="button"
              onClick={() => switchMode("simple")}
              className={`
                rounded-lg px-4 py-2 text-sm transition
                ${
                  searchMode === "simple"
                    ? "bg-white/[0.08] text-white/75"
                    : "text-white/30 hover:text-white/55"
                }
              `}
            >
              Busca simples
            </button>

            <button
              type="button"
              onClick={() => switchMode("advanced")}
              className={`
                rounded-lg px-4 py-2 text-sm transition
                ${
                  searchMode === "advanced"
                    ? "bg-[#c8b27a]/10 text-[#e6d8b6]/75"
                    : "text-white/30 hover:text-white/55"
                }
              `}
            >
              Busca avançada
            </button>
          </div>
        </div>

        {searchMode === "simple" ? (
          <section className="mt-10">
            <div className="grid gap-3 md:grid-cols-[minmax(280px,1fr)_160px_190px]">
              <div>
                <FormLabel>Procurar carta</FormLabel>

                <input
                  autoFocus
                  type="search"
                  value={simpleSearch}
                  onChange={(event) =>
                    updateSimpleSearch(event.target.value)
                  }
                  placeholder="Ex.: Sol Ring, Atraxa..."
                  className={inputClass}
                />
              </div>

              <div>
                <FormLabel>Cor</FormLabel>

                <select
                  value={simpleColorFilter}
                  onChange={(event) =>
                    setSimpleColorFilter(event.target.value)
                  }
                  className={selectClass}
                >
                  <option>Todas</option>
                  <option value="W">Branco</option>
                  <option value="U">Azul</option>
                  <option value="B">Preto</option>
                  <option value="R">Vermelho</option>
                  <option value="G">Verde</option>
                  <option value="C">Incolor</option>
                </select>
              </div>

              <div>
                <FormLabel>Tipo</FormLabel>

                <select
                  value={simpleTypeFilter}
                  onChange={(event) =>
                    setSimpleTypeFilter(event.target.value)
                  }
                  className={selectClass}
                >
                  <option>Todos</option>
                  <option>Criatura</option>
                  <option>Artefato</option>
                  <option>Encantamento</option>
                  <option>Planeswalker</option>
                  <option>Instantânea</option>
                  <option>Feitiço</option>
                  <option>Terreno</option>
                </select>
              </div>
            </div>
          </section>
        ) : (
          <form
            onSubmit={(event) => void runAdvancedSearch(event)}
            className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-[#101013]"
          >
            <div className="border-b border-white/[0.07] px-5 py-5 md:px-7">
              <p className="text-xs uppercase tracking-[0.22em] text-[#c8b27a]/50">
                Busca avançada
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                Refine exatamente o que você procura
              </h2>

              <p className="mt-2 max-w-3xl text-xs leading-5 text-white/25">
                Você pode combinar vários critérios ao mesmo tempo.
                Campos vazios são ignorados.
              </p>
            </div>

            <div className="divide-y divide-white/[0.07]">
              <AdvancedRow
                label="Nome"
                description="Qualquer palavra que apareça no nome da carta."
              >
                <input
                  value={advanced.name}
                  onChange={(event) =>
                    updateAdvanced("name", event.target.value)
                  }
                  placeholder='Ex.: "Fire"'
                  className={inputClass}
                />
              </AdvancedRow>

              <AdvancedRow
                label="Texto"
                description="Pesquisa no texto Oracle da carta."
              >
                <input
                  value={advanced.text}
                  onChange={(event) =>
                    updateAdvanced("text", event.target.value)
                  }
                  placeholder='Ex.: "draw a card"'
                  className={inputClass}
                />
              </AdvancedRow>

              <AdvancedRow
                label="Linha de tipo"
                description="Tipo, subtipo ou supertipo."
              >
                <input
                  value={advanced.type}
                  onChange={(event) =>
                    updateAdvanced("type", event.target.value)
                  }
                  placeholder="Ex.: Dinosaur, Artifact, Wizard..."
                  className={inputClass}
                />
              </AdvancedRow>

              <AdvancedRow
                label="Cores"
                description="Cor impressa da carta."
              >
                <div className="space-y-3">
                  <ColorChecks
                    selected={advanced.colors}
                    colorless={advanced.colorless}
                    onToggleColor={(color) =>
                      toggleAdvancedColor(
                        "colors",
                        "colorless",
                        color
                      )
                    }
                    onToggleColorless={() =>
                      toggleColorless(
                        "colors",
                        "colorless"
                      )
                    }
                  />

                  <select
                    value={advanced.colorMode}
                    onChange={(event) =>
                      updateAdvanced(
                        "colorMode",
                        event.target.value as ColorMatchMode
                      )
                    }
                    className={`${selectClass} max-w-xs`}
                  >
                    <option value="include">
                      Inclui estas cores
                    </option>
                    <option value="exact">
                      Exatamente estas cores
                    </option>
                    <option value="at_most">
                      No máximo estas cores
                    </option>
                  </select>
                </div>
              </AdvancedRow>

              <AdvancedRow
                label="Comandante"
                description="Identidade de cor para Commander."
              >
                <div className="space-y-3">
                  <ColorChecks
                    selected={advanced.identity}
                    colorless={advanced.identityColorless}
                    onToggleColor={(color) =>
                      toggleAdvancedColor(
                        "identity",
                        "identityColorless",
                        color
                      )
                    }
                    onToggleColorless={() =>
                      toggleColorless(
                        "identity",
                        "identityColorless"
                      )
                    }
                  />

                  <select
                    value={advanced.identityMode}
                    onChange={(event) =>
                      updateAdvanced(
                        "identityMode",
                        event.target.value as ColorMatchMode
                      )
                    }
                    className={`${selectClass} max-w-xs`}
                  >
                    <option value="include">
                      Inclui estas cores
                    </option>
                    <option value="exact">
                      Exatamente estas cores
                    </option>
                    <option value="at_most">
                      No máximo estas cores
                    </option>
                  </select>
                </div>
              </AdvancedRow>

              <AdvancedRow
                label="Custo de mana"
                description="Pesquisa pelo custo impresso."
              >
                <input
                  value={advanced.manaCost}
                  onChange={(event) =>
                    updateAdvanced(
                      "manaCost",
                      event.target.value
                    )
                  }
                  placeholder='Ex.: "{W}{U}"'
                  className={`${inputClass} max-w-sm`}
                />
              </AdvancedRow>

              <AdvancedRow
                label="Valor de mana"
                description="Compare o mana value da carta."
              >
                <div className="grid max-w-xl gap-2 sm:grid-cols-[190px_1fr]">
                  <select
                    value={advanced.manaValueOperator}
                    onChange={(event) =>
                      updateAdvanced(
                        "manaValueOperator",
                        event.target.value as CompareOperator
                      )
                    }
                    className={selectClass}
                  >
                    <CompareOptions />
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={advanced.manaValue}
                    onChange={(event) =>
                      updateAdvanced(
                        "manaValue",
                        event.target.value
                      )
                    }
                    placeholder="Ex.: 2"
                    className={inputClass}
                  />
                </div>
              </AdvancedRow>

              <AdvancedRow
                label="Jogos"
                description="Onde a impressão está disponível."
              >
                <CheckboxList
                  options={gameOptions}
                  selected={advanced.games}
                  onToggle={(value) =>
                    updateAdvanced(
                      "games",
                      toggleArrayValue(
                        advanced.games,
                        value
                      )
                    )
                  }
                />
              </AdvancedRow>

              <AdvancedRow
                label="Formato"
                description="Filtre pela legalidade em um formato."
              >
                <div className="grid max-w-xl gap-2 sm:grid-cols-2">
                  <select
                    value={advanced.legalityStatus}
                    onChange={(event) =>
                      updateAdvanced(
                        "legalityStatus",
                        event.target.value
                      )
                    }
                    className={selectClass}
                  >
                    {legalityOptions.map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </select>

                  <select
                    value={advanced.legalityFormat}
                    onChange={(event) =>
                      updateAdvanced(
                        "legalityFormat",
                        event.target.value
                      )
                    }
                    className={selectClass}
                  >
                    <option value="">
                      Qualquer formato
                    </option>

                    {formatOptions.map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </AdvancedRow>

              <AdvancedRow
                label="Edição"
                description="Código ou nome da coleção."
              >
                <input
                  value={advanced.set}
                  onChange={(event) =>
                    updateAdvanced("set", event.target.value)
                  }
                  placeholder="Ex.: MH3 ou Modern Horizons 3"
                  className={`${inputClass} max-w-xl`}
                />
              </AdvancedRow>

              <AdvancedRow
                label="Raridade"
                description="Pode selecionar mais de uma."
              >
                <CheckboxList
                  options={rarityOptions}
                  selected={advanced.rarities}
                  onToggle={(value) =>
                    updateAdvanced(
                      "rarities",
                      toggleArrayValue(
                        advanced.rarities,
                        value
                      )
                    )
                  }
                />
              </AdvancedRow>

              <AdvancedRow
                label="Preço"
                description="Preço em USD da impressão."
              >
                <div className="grid max-w-xl gap-2 sm:grid-cols-[190px_1fr]">
                  <select
                    value={advanced.priceOperator}
                    onChange={(event) =>
                      updateAdvanced(
                        "priceOperator",
                        event.target.value as CompareOperator
                      )
                    }
                    className={selectClass}
                  >
                    <CompareOptions />
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={advanced.price}
                    onChange={(event) =>
                      updateAdvanced(
                        "price",
                        event.target.value
                      )
                    }
                    placeholder="Ex.: 15.00"
                    className={inputClass}
                  />
                </div>
              </AdvancedRow>

              <AdvancedRow
                label="Artista"
                description="Nome do artista da impressão."
              >
                <input
                  value={advanced.artist}
                  onChange={(event) =>
                    updateAdvanced(
                      "artist",
                      event.target.value
                    )
                  }
                  placeholder='Ex.: "Magali"'
                  className={`${inputClass} max-w-xl`}
                />
              </AdvancedRow>

              <AdvancedRow
                label="Flavor text"
                description="Palavras no texto de ambientação."
              >
                <input
                  value={advanced.flavor}
                  onChange={(event) =>
                    updateAdvanced(
                      "flavor",
                      event.target.value
                    )
                  }
                  placeholder="Ex.: Jhoira"
                  className={`${inputClass} max-w-xl`}
                />
              </AdvancedRow>

              <AdvancedRow
                label="Idioma"
                description="Idioma da impressão."
              >
                <select
                  value={advanced.language}
                  onChange={(event) =>
                    updateAdvanced(
                      "language",
                      event.target.value
                    )
                  }
                  className={`${selectClass} max-w-xs`}
                >
                  {languageOptions.map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </AdvancedRow>

              <AdvancedRow
                label="Preferências"
                description="Como os resultados serão exibidos."
              >
                <div className="grid max-w-3xl gap-2 sm:grid-cols-2">
                  <select
                    value={advanced.view}
                    onChange={(event) =>
                      updateAdvanced(
                        "view",
                        event.target.value as ViewMode
                      )
                    }
                    className={selectClass}
                  >
                    <option value="images">
                      Mostrar como imagens
                    </option>
                    <option value="compact">
                      Mostrar como lista
                    </option>
                  </select>

                  <select
                    value={advanced.sort}
                    onChange={(event) =>
                      updateAdvanced(
                        "sort",
                        event.target.value as SortMode
                      )
                    }
                    className={selectClass}
                  >
                    <option value="name">
                      Ordenar por nome
                    </option>
                    <option value="released">
                      Lançamentos recentes
                    </option>
                    <option value="mv">
                      Valor de mana
                    </option>
                    <option value="price_desc">
                      Maior preço
                    </option>
                    <option value="price_asc">
                      Menor preço
                    </option>
                  </select>
                </div>
              </AdvancedRow>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-black/10 px-5 py-5 md:px-7">
              <button
                type="button"
                onClick={clearAdvanced}
                className="text-sm text-white/30 transition hover:text-white/60"
              >
                Limpar tudo
              </button>

              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#f4f1e8] px-6 py-3 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-40"
              >
                {loading
                  ? "Pesquisando..."
                  : "Pesquisar cartas"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-white/25">
            {loading
              ? "Procurando..."
              : searchMode === "simple" &&
                  simpleSearch.trim().length < 2
                ? "Digite pelo menos 2 letras."
                : `${visibleCards.length} ${
                    visibleCards.length === 1
                      ? "resultado"
                      : "resultados"
                  }`}
          </p>

          {visibleCards.length > 0 && (
            <div className="inline-flex rounded-lg border border-white/10 p-1">
              <button
                type="button"
                onClick={() => setResultView("images")}
                className={`
                  rounded-md px-3 py-1.5 text-xs transition
                  ${
                    resultView === "images"
                      ? "bg-white/[0.07] text-white/65"
                      : "text-white/25 hover:text-white/50"
                  }
                `}
              >
                Grade
              </button>

              <button
                type="button"
                onClick={() => setResultView("compact")}
                className={`
                  rounded-md px-3 py-1.5 text-xs transition
                  ${
                    resultView === "compact"
                      ? "bg-white/[0.07] text-white/65"
                      : "text-white/25 hover:text-white/50"
                  }
                `}
              >
                Lista
              </button>
            </div>
          )}
        </div>

        {errorMessage && (
          <p className="mt-5 rounded-xl border border-red-300/10 bg-red-300/[0.03] px-4 py-3 text-sm text-red-100/55">
            {errorMessage}
          </p>
        )}

        {loading ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map(
              (_, index) => (
                <div
                  key={index}
                  className="aspect-[488/680] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.015]"
                />
              )
            )}
          </div>
        ) : visibleCards.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
            <p className="text-sm text-white/30">
              {searchMode === "simple" &&
              simpleSearch.trim().length < 2
                ? "Procure pelo nome de uma carta para começar."
                : searchMode === "advanced"
                  ? "Preencha os critérios e clique em Pesquisar cartas."
                  : "Nenhuma carta encontrada."}
            </p>
          </div>
        ) : resultView === "images" ? (
          <CardGrid
            cards={visibleCards}
            onSelect={setSelectedCard}
          />
        ) : (
          <CardList
            cards={visibleCards}
            onSelect={setSelectedCard}
          />
        )}
      </div>

      {selectedCard && (
        <CardDetailsModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </main>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0d0d10] px-4 py-3 text-sm text-white/70 outline-none transition placeholder:text-white/18 focus:border-white/25";

const selectClass =
  "w-full rounded-xl border border-white/10 bg-[#0d0d10] px-3 py-3 text-sm text-white/55 outline-none transition focus:border-white/25";

function FormLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25">
      {children}
    </label>
  );
}

function AdvancedRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 px-5 py-5 md:grid-cols-[190px_minmax(0,1fr)] md:px-7">
      <div>
        <p className="text-sm font-medium text-white/55">
          {label}
        </p>

        <p className="mt-1 text-[11px] leading-4 text-white/20">
          {description}
        </p>
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ColorChecks({
  selected,
  colorless,
  onToggleColor,
  onToggleColorless,
}: {
  selected: string[];
  colorless: boolean;
  onToggleColor: (color: string) => void;
  onToggleColorless: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colorOptions.map((color) => (
        <button
          key={color.value}
          type="button"
          onClick={() => onToggleColor(color.value)}
          className={`
            flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition
            ${
              selected.includes(color.value)
                ? "border-[#c8b27a]/35 bg-[#c8b27a]/10 text-[#f4e7c5]/80"
                : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/55"
            }
          `}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[9px] font-semibold">
            {color.symbol}
          </span>
          {color.label}
        </button>
      ))}

      <button
        type="button"
        onClick={onToggleColorless}
        className={`
          flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition
          ${
            colorless
              ? "border-[#c8b27a]/35 bg-[#c8b27a]/10 text-[#f4e7c5]/80"
              : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/55"
          }
        `}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[9px] font-semibold">
          C
        </span>
        Incolor
      </button>
    </div>
  );
}

function CheckboxList({
  options,
  selected,
  onToggle,
}: {
  options: ReadonlyArray<{
    value: string;
    label: string;
  }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-3">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-2 text-xs text-white/45"
        >
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => onToggle(option.value)}
            className="h-4 w-4 accent-[#d8c28b]"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function CompareOptions() {
  return (
    <>
      <option value="eq">igual a</option>
      <option value="neq">diferente de</option>
      <option value="lt">menor que</option>
      <option value="lte">menor ou igual a</option>
      <option value="gt">maior que</option>
      <option value="gte">maior ou igual a</option>
    </>
  );
}

function CardGrid({
  cards,
  onSelect,
}: {
  cards: CardItem[];
  onSelect: (card: CardItem) => void;
}) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {cards.map((card) => {
        const image = proxiedImage(
          card.image_uri_large ?? card.image_uri
        );

        return (
          <button
            key={card.scryfall_id}
            type="button"
            onClick={() => onSelect(card)}
            className="group min-w-0 text-left"
          >
            <div className="aspect-[488/680] overflow-hidden rounded-[4.6%] border border-white/10 bg-[#111114] transition group-hover:-translate-y-1 group-hover:border-white/25">
              {image ? (
                <img
                  src={image}
                  alt={card.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-center text-xs text-white/30">
                  {card.name}
                </div>
              )}
            </div>

            <p className="mt-3 truncate text-sm font-medium text-white/65 group-hover:text-white/85">
              {card.name}
            </p>

            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="truncate text-[10px] uppercase tracking-[0.1em] text-white/20">
                {card.set} · #{card.collector_number}
              </p>

              <p className="shrink-0 text-[10px] text-white/30">
                {formatUsd(card.usd_price)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CardList({
  cards,
  onSelect,
}: {
  cards: CardItem[];
  onSelect: (card: CardItem) => void;
}) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
      {cards.map((card) => {
        const image = proxiedImage(
          card.image_uri_large ?? card.image_uri
        );

        return (
          <button
            key={card.scryfall_id}
            type="button"
            onClick={() => onSelect(card)}
            className="grid w-full grid-cols-[54px_minmax(0,1fr)] items-center gap-4 border-b border-white/[0.06] bg-[#101013] px-4 py-3 text-left transition last:border-b-0 hover:bg-white/[0.025] md:grid-cols-[54px_minmax(200px,1fr)_220px_100px_100px]"
          >
            <div className="h-16 w-12 overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
              {image ? (
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white/70">
                {card.name}
              </p>

              <p className="mt-1 truncate text-xs text-white/25 md:hidden">
                {card.type_line}
              </p>
            </div>

            <p className="hidden truncate text-xs text-white/30 md:block">
              {card.type_line}
            </p>

            <p className="hidden text-xs uppercase text-white/25 md:block">
              {card.set}
            </p>

            <p className="hidden text-right text-xs text-white/35 md:block">
              {formatUsd(card.usd_price)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function CardDetailsModal({
  card,
  onClose,
}: {
  card: CardItem;
  onClose: () => void;
}) {
  const image = proxiedImage(
    card.image_uri_large ?? card.image_uri
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/12 bg-[#101013] p-5 shadow-2xl md:p-7">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-white/35 transition hover:text-white"
        >
          ×
        </button>

        <div className="grid gap-7 md:grid-cols-[250px_1fr]">
          <div className="overflow-hidden rounded-[4.6%] border border-white/10 bg-[#111114]">
            <div className="aspect-[488/680]">
              {image ? (
                <img
                  src={image}
                  alt={card.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-5 text-center text-sm text-white/30">
                  {card.name}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#c8b27a]/50">
              {card.set_name}
            </p>

            <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
              <h2 className="text-3xl font-semibold tracking-tight">
                {card.name}
              </h2>

              <p className="text-sm text-white/45">
                {formatUsd(card.usd_price)}
              </p>
            </div>

            <p className="mt-3 text-sm text-white/35">
              {card.type_line || "Tipo não informado"}
            </p>

            {card.mana_cost && (
              <p className="mt-2 font-mono text-xs text-white/30">
                {card.mana_cost}
              </p>
            )}

            {card.oracle_text && (
              <p className="mt-6 whitespace-pre-line text-sm leading-6 text-white/50">
                {card.oracle_text}
              </p>
            )}

            {card.flavor_text && (
              <p className="mt-5 border-l border-[#c8b27a]/20 pl-4 text-sm italic leading-6 text-white/30">
                {card.flavor_text}
              </p>
            )}

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Detail
                label="Edição"
                value={card.set}
              />

              <Detail
                label="Número"
                value={`#${card.collector_number}`}
              />

              <Detail
                label="Raridade"
                value={rarityLabel(card.rarity)}
              />

              <Detail
                label="Mana value"
                value={
                  card.mana_value === null
                    ? "—"
                    : String(card.mana_value)
                }
              />

              <Detail
                label="Idioma"
                value={card.language.toUpperCase()}
              />

              <Detail
                label="Artista"
                value={card.artist || "—"}
              />
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              <Link
                href="/colecao"
                className="rounded-xl bg-[#f4f1e8] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white"
              >
                Ir para minha coleção
              </Link>

              <Link
                href="/decks/novo"
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/45 transition hover:border-white/25 hover:text-white/70"
              >
                Criar deck
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/10 px-3 py-3">
      <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
        {label}
      </p>

      <p className="mt-1 truncate text-sm text-white/50">
        {value}
      </p>
    </div>
  );
}
