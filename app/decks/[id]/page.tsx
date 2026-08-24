"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Deck = {
  id: string;
  owner_id: string;
  name: string;
  format: string;
  is_public: boolean;
  description: string | null;
  commander_scryfall_id: string | null;
  created_at: string;
  updated_at: string;
};

const formats = [
  "Commander",
  "Standard",
  "Modern",
  "Pioneer",
  "Pauper",
  "Legacy",
  "Vintage",
  "Brawl",
  "Historic",
  "Timeless",
  "Outro",
];


type ImportBoard =
  | "mainboard"
  | "commander"
  | "sideboard"
  | "maybeboard";

type ImportedCardLine = {
  quantity: number;
  name: string;
  board: ImportBoard;
  original: string;
};

type ParsedImport = {
  cards: ImportedCardLine[];
  invalidLines: string[];
  totalCopies: number;
};

function truncateText(text: string, maxLength = 500) {
  const cleanText = text.trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  return `${cleanText.slice(0, maxLength).trimEnd()}...`;
}

function parseImportList(value: string): ParsedImport {
  const lines = value.split(/\r?\n/);

  const cards: ImportedCardLine[] = [];
  const invalidLines: string[] = [];

  let currentBoard: ImportBoard = "mainboard";

  const sectionMap: Record<string, ImportBoard> = {
    commander: "commander",
    commanders: "commander",
    "command zone": "commander",
    mainboard: "mainboard",
    deck: "mainboard",
    maindeck: "mainboard",
    creatures: "mainboard",
    creature: "mainboard",
    artifacts: "mainboard",
    artifact: "mainboard",
    enchantments: "mainboard",
    enchantment: "mainboard",
    instants: "mainboard",
    instant: "mainboard",
    sorceries: "mainboard",
    sorcery: "mainboard",
    lands: "mainboard",
    land: "mainboard",
    planeswalkers: "mainboard",
    planeswalker: "mainboard",
    sideboard: "sideboard",
    "side board": "sideboard",
    maybeboard: "maybeboard",
    "maybe board": "maybeboard",
    considering: "maybeboard",
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    const normalizedHeading = line
      .replace(/[:：]$/, "")
      .trim()
      .toLocaleLowerCase("en-US");

    if (sectionMap[normalizedHeading]) {
      currentBoard = sectionMap[normalizedHeading];
      continue;
    }

    // Aceita:
    // 1 Sol Ring
    // 1x Sol Ring
    // 1 x Sol Ring
    // 4 Lightning Bolt (M11) 149
    // 1 Sol Ring [CMM]
    const match = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);

    if (!match) {
      invalidLines.push(line);
      continue;
    }

    const quantity = Number(match[1]);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      invalidLines.push(line);
      continue;
    }

    let cardName = match[2].trim();

    // Remove informações comuns de impressão no fim da linha:
    // (SET) 123 / [SET] / (SET)
    cardName = cardName
      .replace(/\s+\([A-Za-z0-9]{2,8}\)\s+\S+$/u, "")
      .replace(/\s+\[[A-Za-z0-9]{2,8}\]\s*$/u, "")
      .replace(/\s+\([A-Za-z0-9]{2,8}\)\s*$/u, "")
      .trim();

    if (!cardName) {
      invalidLines.push(line);
      continue;
    }

    cards.push({
      quantity,
      name: cardName,
      board: currentBoard,
      original: line,
    });
  }

  return {
    cards,
    invalidLines,
    totalCopies: cards.reduce(
      (total, card) => total + card.quantity,
      0
    ),
  };
}

type ResolvedCard = {
  id: string;
  oracle_id?: string;
  name: string;
  requested_name?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  raw_text?: string;
  image_uris?: {
    normal?: string;
    large?: string;
  };
  card_faces?: {
    image_uris?: {
      normal?: string;
      large?: string;
    };
  }[];
};

function getCardImage(card?: ResolvedCard) {
  return (
    card?.image_uris?.normal ??
    card?.image_uris?.large ??
    card?.card_faces?.[0]?.image_uris?.normal ??
    card?.card_faces?.[0]?.image_uris?.large ??
    null
  );
}

function getProxiedCardImage(card?: ResolvedCard) {
  const image = getCardImage(card);
  if (!image) return null;

  return `/api/scryfall/image?url=${encodeURIComponent(image)}`;
}

type DeckCardRow = {
  id?: string;
  deck_id: string;
  scryfall_id: string;
  oracle_id: string | null;
  quantity: number;
  board: ImportBoard;
  created_at?: string;
  card?: ResolvedCard;
};

type CardPrinting = {
  scryfall_id: string;
  oracle_id: string | null;
  name: string;
  type_line: string | null;
  image_uri: string | null;
  image_uri_large: string | null;
  set: string;
  set_name: string;
  collector_number: string;
  lang: string;
  released_at: string;
};

type CardTypeGroup =
  | "Comandante"
  | "Artefatos"
  | "Criaturas"
  | "Encantamentos"
  | "Planeswalkers"
  | "Instantâneas"
  | "Terrenos"
  | "Feitiços"
  | "Outros";

type OrganizeBy =
  | "Categoria"
  | "Tipo"
  | "Identidade de cor"
  | "Cor"
  | "Nome";

const cardTypeGroupOrder: CardTypeGroup[] = [
  "Comandante",
  "Artefatos",
  "Criaturas",
  "Encantamentos",
  "Planeswalkers",
  "Instantâneas",
  "Terrenos",
  "Feitiços",
  "Outros",
];

const colorGroupOrder = [
  "Comandante",
  "Branco",
  "Azul",
  "Preto",
  "Vermelho",
  "Verde",
  "Multicolorida",
  "Incolor",
];

const colorNames: Record<string, string> = {
  W: "Branco",
  U: "Azul",
  B: "Preto",
  R: "Vermelho",
  G: "Verde",
};

const colorOrder = ["W", "U", "B", "R", "G"];

function normalizeColors(colors?: string[] | null) {
  return [...(colors ?? [])]
    .filter((color) => colorOrder.includes(color))
    .sort((a, b) => colorOrder.indexOf(a) - colorOrder.indexOf(b));
}

function getColorsFromCardData(cardData: unknown): string[] {
  if (!cardData || typeof cardData !== "object") return [];

  const colors = (cardData as { colors?: unknown }).colors;

  if (!Array.isArray(colors)) return [];

  return colors.filter((color): color is string => typeof color === "string");
}

function getOracleTextFromCardData(cardData: unknown): string {
  if (!cardData || typeof cardData !== "object") return "";

  const data = cardData as {
    oracle_text?: unknown;
    card_faces?: unknown;
  };

  if (typeof data.oracle_text === "string") {
    return data.oracle_text;
  }

  if (Array.isArray(data.card_faces)) {
    return data.card_faces
      .map((face) => {
        if (!face || typeof face !== "object") return "";
        const oracleText = (face as { oracle_text?: unknown }).oracle_text;
        return typeof oracleText === "string" ? oracleText : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function getCardTypeGroup(row: DeckCardRow): CardTypeGroup {
  if (row.board === "commander") {
    return "Comandante";
  }

  const typeLine = row.card?.type_line?.toLowerCase() ?? "";

  if (typeLine.includes("land")) return "Terrenos";
  if (typeLine.includes("creature")) return "Criaturas";
  if (typeLine.includes("artifact")) return "Artefatos";
  if (typeLine.includes("enchantment")) return "Encantamentos";
  if (typeLine.includes("planeswalker")) return "Planeswalkers";
  if (typeLine.includes("instant")) return "Instantâneas";
  if (typeLine.includes("sorcery")) return "Feitiços";

  return "Outros";
}

function getFunctionalCategory(row: DeckCardRow) {
  if (row.board === "commander") return "Comandante";

 const typeLine =
  row.card?.type_line?.toLocaleLowerCase("pt-BR") ?? "";

const oracleText =
  row.card?.oracle_text?.toLocaleLowerCase("pt-BR") ?? "";

const rawText =
  row.card?.raw_text?.toLocaleLowerCase("pt-BR") ?? "";

const text = `${typeLine} ${oracleText} ${rawText}`;

  // Categorias de função. A ordem importa: categorias mais específicas
  // são verificadas antes das categorias genéricas.
  if (/infect|toxic|poison counter|poison counters/.test(text)) return "Infect";
  if (/venture into the dungeon|take the initiative|dungeon/.test(text)) return "Dungeon";
  if (/copy target|create a token that's a copy|create a token that is a copy|copy of|triggers an additional time|trigger an additional time/.test(text)) return "Cópia";
  if (/gain control of|you control enchanted|control of target/.test(text)) return "Roubo";
  if (/can't be blocked|cannot be blocked|menace|flying|shadow|horsemanship/.test(text)) return "Evasão";
  if (/mill \d|mills? \d|put the top .* cards? of .* library into .* graveyard/.test(text)) return "Mill";
  if (/search your library/.test(text)) return "Tutor";
  if (/counter target spell|counter target activated|counter target triggered|counter target ability/.test(text)) return "Counter";
  if (/destroy all|exile all|each creature gets -\d|all creatures get -\d|destroy each/.test(text)) return "Limpeza de mesa";
  if (/destroy target|exile target|deals? \d+ damage to target creature|target creature gets -\d/.test(text)) return "Remoção";
  if (/return .* from your graveyard to the battlefield|put .* from .* graveyard onto the battlefield|reanimate/.test(text)) return "Reanimação";
  if (/return .* from your graveyard to your hand|return target .* card from .* graveyard|return up to .* cards? from .* graveyard/.test(text)) return "Recursão";
  if (/draw (a|one|two|three|four|five|\d+) cards?|draw cards equal|draw that many cards|draw an additional card/.test(text)) return "Compra";
  if (/each opponent loses|target opponent loses|opponents lose|loses? \d+ life/.test(text)) return "Dreno";
  if (/gain \d+ life|gains? life|lifelink/.test(text)) return "Ganho de vida";
  if (/add \{[wubrgc]|add one mana|add two mana|add three mana|search your library for .* land card|put .* land card onto the battlefield/.test(text)) return "Ramp";
  if (/hexproof|indestructible|protection from|phase out|regenerate|prevent all damage/.test(text)) return "Proteção";
  if (/discard a card|discards? \d|target player discards|each opponent discards/.test(text)) return "Descarte";
  if (/sacrifice a creature|sacrifice a permanent|sacrifice another|sacrifice an artifact|sacrifice it/.test(text)) return "Sacrifício";
  if (/create .* token|creates? .* token|create a token/.test(text)) return "Tokens";
  if (/exile .* you control.*return|exile target .* you control.*return|return that card to the battlefield|return it to the battlefield under its owner's control/.test(text)) return "Blink";

  // Quando não houver uma função clara no texto, usa o tipo principal
  // como fallback para a carta não cair numa categoria genérica demais.
  if (typeLine.includes("land")) return "Terrenos";
  if (typeLine.includes("creature")) return "Criaturas";
  if (typeLine.includes("artifact")) return "Artefatos";
  if (typeLine.includes("enchantment")) return "Encantamentos";
  if (typeLine.includes("planeswalker")) return "Planeswalkers";
  if (typeLine.includes("instant")) return "Instantâneas";
  if (typeLine.includes("sorcery")) return "Feitiços";

  return "Outros";
}

function getColorGroup(row: DeckCardRow) {
  if (row.board === "commander") return "Comandante";

  const colors = normalizeColors(row.card?.colors);

  if (colors.length === 0) return "Incolor";
  if (colors.length > 1) return "Multicolorida";

  return colorNames[colors[0]] ?? "Incolor";
}

function getColorIdentityGroup(row: DeckCardRow) {
  if (row.board === "commander") return "Comandante";

  const identity = normalizeColors(row.card?.color_identity);

  if (identity.length === 0) return "Incolor";

  return identity.map((color) => colorNames[color] ?? color).join(" / ");
}

function getNameGroup(row: DeckCardRow) {
  if (row.board === "commander") return "Comandante";

  const name = (row.card?.name ?? row.scryfall_id).trim();
  const firstCharacter = name.charAt(0).toLocaleUpperCase("pt-BR");

  return /[A-ZÀ-ÖØ-Ý]/i.test(firstCharacter) ? firstCharacter : "#";
}

function getOrganizationGroup(row: DeckCardRow, organizeBy: OrganizeBy) {
  switch (organizeBy) {
    case "Tipo":
      return getCardTypeGroup(row);
    case "Identidade de cor":
      return getColorIdentityGroup(row);
    case "Cor":
      return getColorGroup(row);
    case "Nome":
      return getNameGroup(row);
    case "Categoria":
    default:
      return getFunctionalCategory(row);
  }
}

function getGroupOrder(rows: DeckCardRow[], organizeBy: OrganizeBy) {
  if (organizeBy === "Tipo") {
    return cardTypeGroupOrder.filter((groupName) =>
      rows.some((row) => getCardTypeGroup(row) === groupName)
    );
  }

  if (organizeBy === "Cor") {
    return colorGroupOrder.filter((groupName) =>
      rows.some((row) => getColorGroup(row) === groupName)
    );
  }

  const groups = Array.from(
    new Set(rows.map((row) => getOrganizationGroup(row, organizeBy)))
  );

  return groups.sort((a, b) => {
    if (a === "Comandante") return -1;
    if (b === "Comandante") return 1;
    if (a === "Incolor") return 1;
    if (b === "Incolor") return -1;

    return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
  });
}

type CurveOutSelectProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

function CurveOutSelect({
  value,
  options,
  onChange,
}: CurveOutSelectProps) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={selectRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="
          flex w-full items-center justify-between
          rounded-xl
          border border-white/10
          bg-[#0f0f12]
          px-4 py-3
          text-left text-sm text-white/75
          outline-none
          transition
          hover:border-white/20
          focus:border-white/30
        "
      >
        <span>{value}</span>

        <span
          className={`
            text-[10px] text-white/40
            transition-transform
            ${open ? "rotate-180" : ""}
          `}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          className="
  absolute left-0 top-full z-[9999]
  mt-2 w-full
  rounded-xl
  border border-white/10
  bg-[#111114]
  shadow-2xl
"
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`
                block w-full
                rounded-lg
                px-3 py-2.5
                text-left text-sm
                transition
                ${
                  value === option
                    ? "bg-white/[0.09] text-white"
                    : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                }
              `}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DeckPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [isOwner, setIsOwner] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [format, setFormat] = useState("Commander");
  const [isPublic, setIsPublic] = useState(true);
  const [description, setDescription] = useState("");

  const [cardSearch, setCardSearch] = useState("");
  const [cardSearchResults, setCardSearchResults] = useState<string[]>([]);
  const [cardSearchOpen, setCardSearchOpen] = useState(false);
  const [cardSearchLoading, setCardSearchLoading] = useState(false);
  const [cardSearchError, setCardSearchError] = useState("");
  const [cardSearchStatus, setCardSearchStatus] = useState("");
  const [addingCard, setAddingCard] = useState(false);
  const [highlightedCardIndex, setHighlightedCardIndex] = useState(0);
  const [deckSearch, setDeckSearch] = useState("");
  const [deckCards, setDeckCards] = useState<DeckCardRow[]>([]);
  const [selectedCard, setSelectedCard] =
    useState<DeckCardRow | null>(null);
  const [selectedCardQuantity, setSelectedCardQuantity] =
    useState("1");
  const [printingPickerOpen, setPrintingPickerOpen] =
    useState(false);
  const [printingOptions, setPrintingOptions] =
    useState<CardPrinting[]>([]);
  const [printingLoading, setPrintingLoading] =
    useState(false);
  const [changingPrinting, setChangingPrinting] =
    useState(false);
  const [printingError, setPrintingError] =
    useState("");
  const [organizeBy, setOrganizeBy] = useState<OrganizeBy>("Categoria");
  const [viewMode, setViewMode] = useState("Stack");

  const [deckArt, setDeckArt] = useState("/hero-bg.jpg");

  const [updateDeckOpen, setUpdateDeckOpen] = useState(false);
  const [importDeckOpen, setImportDeckOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [exportDeckOpen, setExportDeckOpen] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [shareDeckOpen, setShareDeckOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [deleteDeckOpen, setDeleteDeckOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const priceMenuRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (selectedCard) {
      setSelectedCardQuantity(String(selectedCard.quantity));
    }
  }, [selectedCard]);

  useEffect(() => {
    if (!selectedCard) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (printingPickerOpen) {
          setPrintingPickerOpen(false);
          return;
        }

        setSelectedCard(null);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedCard, printingPickerOpen]);

  const parsedImport = useMemo(
    () => parseImportList(importText),
    [importText]
  );

  const deckCardTotal = useMemo(
    () => deckCards.reduce((total, card) => total + card.quantity, 0),
    [deckCards]
  );

  const visibleDeckCards = useMemo(() => {
    const search = deckSearch.trim().toLocaleLowerCase("pt-BR");

    if (!search) return deckCards;

    return deckCards.filter((row) =>
      (row.card?.name ?? row.scryfall_id)
        .toLocaleLowerCase("pt-BR")
        .includes(search)
    );
  }, [deckCards, deckSearch]);

  const deckCardsByType = useMemo(() => {
    const groupOrder = getGroupOrder(visibleDeckCards, organizeBy);

    return groupOrder
      .map((groupName) => {
        const cards = visibleDeckCards
          .filter(
            (row) => getOrganizationGroup(row, organizeBy) === groupName
          )
          .sort((a, b) =>
            (a.card?.name ?? a.scryfall_id).localeCompare(
              b.card?.name ?? b.scryfall_id,
              "pt-BR",
              { sensitivity: "base" }
            )
          );

        return {
          name: groupName,
          cards,
          quantity: cards.reduce(
            (total, row) => total + row.quantity,
            0
          ),
        };
      })
      .filter((group) => group.cards.length > 0);
  }, [visibleDeckCards, organizeBy]);


  async function loadDeckCards(deckId: string) {
    const { data, error } = await supabase
      .from("deck_cards")
      .select(
        "id, deck_id, scryfall_id, oracle_id, quantity, board, created_at"
      )
      .eq("deck_id", deckId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao carregar cartas do deck:", error);
      return;
    }

    const rows = (data ?? []) as DeckCardRow[];

    if (rows.length === 0) {
      setDeckCards([]);
      return;
    }

    const scryfallIds = Array.from(
      new Set(rows.map((row) => row.scryfall_id))
    );

    const { data: cardData, error: cardsError } = await supabase
      .from("cards")
      .select(
        "scryfall_id, oracle_id, name, type_line, color_identity, card_data, image_uri, image_uri_large"
      )
      .in("scryfall_id", scryfallIds);

    if (cardsError) {
      console.error("Erro ao carregar dados das cartas:", cardsError);
      setDeckCards(rows);
      return;
    }

    const cardsById = new Map<string, ResolvedCard>();

    for (const card of cardData ?? []) {
      cardsById.set(card.scryfall_id, {
        id: card.scryfall_id,
        oracle_id: card.oracle_id ?? undefined,
        name: card.name,
        type_line: card.type_line ?? undefined,
        oracle_text: getOracleTextFromCardData(card.card_data),
raw_text: JSON.stringify(card.card_data ?? {}).toLocaleLowerCase("pt-BR"),
colors: getColorsFromCardData(card.card_data),
        color_identity: Array.isArray(card.color_identity)
          ? card.color_identity.filter(
              (color): color is string => typeof color === "string"
            )
          : [],
        image_uris:
          card.image_uri || card.image_uri_large
            ? {
                normal: card.image_uri ?? undefined,
                large: card.image_uri_large ?? undefined,
              }
            : undefined,
      });
    }

    setDeckCards(
      rows.map((row) => ({
        ...row,
        card: cardsById.get(row.scryfall_id),
      }))
    );
  }

  useEffect(() => {
    const query = cardSearch.trim();

    if (query.length < 2) {
      setCardSearchResults([]);
      setCardSearchOpen(false);
      setCardSearchLoading(false);
      setCardSearchError("");
      return;
    }

    const controller = new AbortController();

    const timeout = window.setTimeout(async () => {
      try {
        setCardSearchLoading(true);
        setCardSearchError("");

        const response = await fetch(
          `/api/scryfall/autocomplete?q=${encodeURIComponent(query)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = (await response.json()) as {
          data?: string[];
          error?: string;
        };

        if (!response.ok) {
  console.error(
    result.error ?? "Não foi possível pesquisar as cartas."
  );

  setCardSearchResults([]);
  setCardSearchOpen(false);
  return;
}

        const suggestions = (result.data ?? []).slice(0, 10);

        setCardSearchResults(suggestions);
        setHighlightedCardIndex(0);
        setCardSearchOpen(suggestions.length > 0);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error("Erro no autocomplete de cartas:", error);
        setCardSearchResults([]);
        setCardSearchOpen(false);
        setCardSearchError("Não foi possível carregar sugestões.");
      } finally {
        if (!controller.signal.aborted) {
          setCardSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [cardSearch]);

  useEffect(() => {
    async function loadDeck() {
      setLoading(true);
      setErrorMessage("");
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("decks")
        .select(
          "id, owner_id, name, format, is_public, description, commander_scryfall_id, created_at, updated_at"
        )
        .eq("id", params.id)
        .maybeSingle();

      if (error) {
       console.error(
  "Erro ao carregar deck:",
  "message =", error.message,
  "code =", error.code,
  "details =", error.details,
  "hint =", error.hint
);
        setErrorMessage(
  error.message ||
  error.details ||
  error.code ||
  "Erro desconhecido ao carregar o deck."
);
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMessage("Deck não encontrado.");
        setLoading(false);
        return;
      }

      setDeck(data);
      setName(data.name);
      setFormat(data.format);
      setIsPublic(data.is_public);
      setDescription(data.description ?? "");

      setIsOwner(Boolean(user && user.id === data.owner_id));

      await loadDeckCards(data.id);

      setLoading(false);
    }

    if (params.id) {
      loadDeck();
    }
  }, [params.id, supabase]);

  useEffect(() => {
    async function loadRandomDeckArt() {
      try {
        const response = await fetch("/api/scryfall/commander", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const result = (await response.json()) as {
          prints?: {
            image?: string;
          }[];
          commander?: {
            image_uris?: {
              large?: string;
              normal?: string;
            };
            card_faces?: {
              image_uris?: {
                large?: string;
                normal?: string;
              };
            }[];
          };
        };

        const images = [
          ...(result.prints ?? [])
            .map((print) => print.image)
            .filter((image): image is string => Boolean(image)),
          result.commander?.image_uris?.large,
          result.commander?.image_uris?.normal,
          result.commander?.card_faces?.[0]?.image_uris?.large,
          result.commander?.card_faces?.[0]?.image_uris?.normal,
        ].filter((image): image is string => Boolean(image));

        if (images.length === 0) return;

        const randomImage =
          images[Math.floor(Math.random() * images.length)];

        setDeckArt(randomImage);
      } catch {
        // Em redes onde o Scryfall estiver bloqueado, usamos o hero local.
      }
    }

    loadRandomDeckArt();
  }, []);


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        priceMenuRef.current &&
        !priceMenuRef.current.contains(event.target as Node)
      ) {
        setPriceOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPriceOpen(false);
      }
    }

    if (priceOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [priceOpen]);

  async function loadCardPrintings(row: DeckCardRow) {
    const oracleId = row.oracle_id ?? row.card?.oracle_id;

    if (!oracleId) {
      setPrintingError(
        "Não foi possível identificar as impressões desta carta."
      );
      return;
    }

    setPrintingLoading(true);
    setPrintingError("");
    setPrintingOptions([]);

    const { data, error } = await supabase
      .from("cards")
      .select(
        "scryfall_id, oracle_id, name, type_line, image_uri, image_uri_large, card_data"
      )
      .eq("oracle_id", oracleId);

    if (error) {
      console.error("Erro ao buscar impressões:", error);
      setPrintingError("Não foi possível carregar as impressões.");
      setPrintingLoading(false);
      return;
    }

    const printings: CardPrinting[] = (data ?? []).map((card) => {
      const cardData = (card.card_data ?? {}) as Record<string, unknown>;

      return {
        scryfall_id: card.scryfall_id,
        oracle_id: card.oracle_id,
        name: card.name,
        type_line: card.type_line,
        image_uri: card.image_uri,
        image_uri_large: card.image_uri_large,
        set:
          typeof cardData.set === "string"
            ? cardData.set.toUpperCase()
            : "—",
        set_name:
          typeof cardData.set_name === "string"
            ? cardData.set_name
            : "Edição desconhecida",
        collector_number:
          typeof cardData.collector_number === "string"
            ? cardData.collector_number
            : "—",
        lang:
          typeof cardData.lang === "string"
            ? cardData.lang.toUpperCase()
            : "—",
        released_at:
          typeof cardData.released_at === "string"
            ? cardData.released_at
            : "",
      };
    });

    printings.sort((a, b) =>
      b.released_at.localeCompare(a.released_at)
    );

    setPrintingOptions(printings);
    setPrintingLoading(false);
  }

  async function changeCardPrinting(printing: CardPrinting) {
    if (
      !deck ||
      !selectedCard ||
      !selectedCard.id ||
      !isOwner ||
      changingPrinting
    ) {
      return;
    }

    if (printing.scryfall_id === selectedCard.scryfall_id) {
      setPrintingPickerOpen(false);
      return;
    }

    setChangingPrinting(true);
    setPrintingError("");

    const { data: existingPrinting, error: existingPrintingError } =
      await supabase
        .from("deck_cards")
        .select("id, quantity")
        .eq("deck_id", deck.id)
        .eq("scryfall_id", printing.scryfall_id)
        .eq("board", selectedCard.board)
        .neq("id", selectedCard.id)
        .maybeSingle();

    if (existingPrintingError) {
      console.error(
        "Erro ao verificar impressão existente:",
        existingPrintingError
      );
      setPrintingError("Não foi possível trocar a impressão.");
      setChangingPrinting(false);
      return;
    }

    if (existingPrinting) {
      const { error: mergeError } = await supabase
        .from("deck_cards")
        .update({
          quantity: existingPrinting.quantity + selectedCard.quantity,
        })
        .eq("id", existingPrinting.id);

      if (mergeError) {
        console.error("Erro ao juntar impressões:", mergeError);
        setPrintingError("Não foi possível trocar a impressão.");
        setChangingPrinting(false);
        return;
      }

      const { error: deleteOldError } = await supabase
        .from("deck_cards")
        .delete()
        .eq("id", selectedCard.id);

      if (deleteOldError) {
        console.error(
          "Erro ao remover impressão anterior:",
          deleteOldError
        );
        setPrintingError("Não foi possível finalizar a troca.");
        setChangingPrinting(false);
        return;
      }

      setSelectedCard(null);
      setPrintingPickerOpen(false);
      await loadDeckCards(deck.id);
      setChangingPrinting(false);
      return;
    }

    const { error } = await supabase
      .from("deck_cards")
      .update({
        scryfall_id: printing.scryfall_id,
        oracle_id: printing.oracle_id,
      })
      .eq("id", selectedCard.id);

    if (error) {
      console.error("Erro ao trocar impressão:", error);
      setPrintingError("Não foi possível trocar a impressão.");
      setChangingPrinting(false);
      return;
    }

    const updatedCard: DeckCardRow = {
      ...selectedCard,
      scryfall_id: printing.scryfall_id,
      oracle_id: printing.oracle_id,
      card: {
        id: printing.scryfall_id,
        oracle_id: printing.oracle_id ?? undefined,
        name: printing.name,
        type_line: printing.type_line ?? undefined,
        image_uris: {
          normal: printing.image_uri ?? undefined,
          large: printing.image_uri_large ?? undefined,
        },
      },
    };

    setSelectedCard(updatedCard);
    setPrintingPickerOpen(false);

    const updatedAt = new Date().toISOString();

    await supabase
      .from("decks")
      .update({ updated_at: updatedAt })
      .eq("id", deck.id)
      .eq("owner_id", deck.owner_id);

    setDeck({
      ...deck,
      updated_at: updatedAt,
    });

    await loadDeckCards(deck.id);
    setChangingPrinting(false);
  }

  async function setCardQuantity(
    row: DeckCardRow,
    newQuantity: number
  ) {
    if (!deck || !isOwner || !row.id) return;

    const quantity = Math.max(1, Math.floor(newQuantity));

    const { error } = await supabase
      .from("deck_cards")
      .update({
        quantity,
      })
      .eq("id", row.id);

    if (error) {
      console.error("Erro ao alterar quantidade:", error);
      return;
    }

    const updatedAt = new Date().toISOString();

    await supabase
      .from("decks")
      .update({
        updated_at: updatedAt,
      })
      .eq("id", deck.id)
      .eq("owner_id", deck.owner_id);

    setDeck({
      ...deck,
      updated_at: updatedAt,
    });

    if (selectedCard?.id === row.id) {
      setSelectedCard({
        ...selectedCard,
        quantity,
      });
    }

    setSelectedCardQuantity(String(quantity));

    await loadDeckCards(deck.id);
  }

  async function increaseCardQuantity(row: DeckCardRow) {
    await setCardQuantity(row, row.quantity + 1);
  }

  async function decreaseCardQuantity(row: DeckCardRow) {
    if (!deck || !isOwner || !row.id) return;

    if (row.quantity <= 1) {
      const { error } = await supabase
        .from("deck_cards")
        .delete()
        .eq("id", row.id);

      if (error) {
        console.error("Erro ao remover carta:", error);
        return;
      }

      setSelectedCard(null);
      await loadDeckCards(deck.id);
      return;
    }

    await setCardQuantity(row, row.quantity - 1);
  }

  async function addCardToDeck(cardName: string) {
    const cleanName = cardName.trim();

    if (!deck || !isOwner || !cleanName || addingCard) {
      return;
    }

    setAddingCard(true);
    setCardSearchError("");
    setCardSearchStatus(`Adicionando ${cleanName}...`);

    try {
      const response = await fetch("/api/scryfall/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifiers: [
            {
              name: cleanName,
            },
          ],
        }),
      });

      const result = (await response.json()) as {
        cards?: ResolvedCard[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ?? "Não foi possível consultar a carta."
        );
      }

      const card = result.cards?.[0];

      if (!card) {
        throw new Error("Carta não encontrada.");
      }

      const { data: existingCard, error: existingError } = await supabase
        .from("deck_cards")
        .select("id, quantity")
        .eq("deck_id", deck.id)
        .eq("scryfall_id", card.id)
        .eq("board", "mainboard")
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingCard) {
        const { error: updateError } = await supabase
          .from("deck_cards")
          .update({
            quantity: existingCard.quantity + 1,
          })
          .eq("id", existingCard.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from("deck_cards")
          .insert({
            deck_id: deck.id,
            scryfall_id: card.id,
            oracle_id: card.oracle_id ?? null,
            quantity: 1,
            board: "mainboard",
          });

        if (insertError) {
          throw insertError;
        }
      }

      const updatedAt = new Date().toISOString();

      const { error: deckUpdateError } = await supabase
        .from("decks")
        .update({
          updated_at: updatedAt,
        })
        .eq("id", deck.id)
        .eq("owner_id", deck.owner_id);

      if (deckUpdateError) {
        console.error(
          "Carta adicionada, mas não foi possível atualizar a data do deck:",
          deckUpdateError
        );
      }

      setDeck({
        ...deck,
        updated_at: updatedAt,
      });

      await loadDeckCards(deck.id);

      setCardSearch("");
      setCardSearchResults([]);
      setCardSearchOpen(false);
      setHighlightedCardIndex(0);
      setCardSearchStatus(`${card.name} adicionada ✓`);

      window.setTimeout(() => {
        setCardSearchStatus("");
      }, 1800);
    } catch (error) {
      console.error("Erro ao adicionar carta:", error);

      setCardSearchError(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar a carta."
      );

      setCardSearchStatus("");
    } finally {
      setAddingCard(false);
    }
  }

  function startEditing() {
    if (!deck) return;

    setName(deck.name);
    setFormat(deck.format);
    setIsPublic(deck.is_public);
    setDescription(deck.description ?? "");
    setErrorMessage("");
    setEditing(true);
  }

  function cancelEditing() {
    if (!deck) return;

    setName(deck.name);
    setFormat(deck.format);
    setIsPublic(deck.is_public);
    setDescription(deck.description ?? "");
    setErrorMessage("");
    setEditing(false);
  }

  async function saveDeck() {
    if (!deck || !isOwner) return;

    const cleanName = name.trim();

    if (!cleanName) {
      setErrorMessage("Digite um nome para o deck.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const cleanDescription = description.trim() || null;
    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("decks")
      .update({
        name: cleanName,
        format,
        is_public: isPublic,
        description: cleanDescription,
        updated_at: updatedAt,
      })
      .eq("id", deck.id)
      .eq("owner_id", deck.owner_id);

    if (error) {
      console.error("Erro ao editar deck:", error);
      setErrorMessage(`Erro: ${error.message}`);
      setSaving(false);
      return;
    }

    setDeck({
      ...deck,
      name: cleanName,
      format,
      is_public: isPublic,
      description: cleanDescription,
      updated_at: updatedAt,
    });

    setEditing(false);
    setSaving(false);
  }

  const clipboardDeckText = useMemo(() => {
    if (deckCards.length === 0) return "";

    const boardOrder: ImportBoard[] = [
      "commander",
      "mainboard",
      "sideboard",
      "maybeboard",
    ];

    return [...deckCards]
      .sort((a, b) => {
        const boardDifference =
          boardOrder.indexOf(a.board) - boardOrder.indexOf(b.board);

        if (boardDifference !== 0) return boardDifference;

        return (a.card?.name ?? a.scryfall_id).localeCompare(
          b.card?.name ?? b.scryfall_id
        );
      })
      .map(
        (row) =>
          `${row.quantity} ${row.card?.name ?? row.scryfall_id}`
      )
      .join("\n");
  }, [deckCards]);

  const exportText = useMemo(() => {
    if (!deck) return "";

    const lines = [
      deck.name,
      `Formato: ${deck.format}`,
      `Visibilidade: ${deck.is_public ? "Público" : "Privado"}`,
    ];

    if (deck.description) {
      lines.push("", `Notas: ${deck.description}`);
    }

    if (clipboardDeckText) {
      lines.push("", "Cartas", "", clipboardDeckText);
    } else {
      lines.push("", "Deck", "", "Nenhuma carta adicionada ainda.");
    }

    return lines.join("\n");
  }, [deck, clipboardDeckText]);

  async function copyExportText() {
    try {
      const textToCopy =
        clipboardDeckText ||
        "Nenhuma carta adicionada ao deck ainda.";

      await navigator.clipboard.writeText(textToCopy);
      setExportCopied(true);

      window.setTimeout(() => {
        setExportCopied(false);
      }, 1800);
    } catch (error) {
      console.error("Erro ao copiar deck:", error);
      setErrorMessage("Não foi possível copiar o deck.");
    }
  }

  function downloadExportText() {
    if (!deck) return;

    const safeName =
      deck.name
        .trim()
        .replace(/[<>:"/\\|?*]+/g, "-")
        .replace(/\s+/g, "-")
        .toLocaleLowerCase("pt-BR") || "deck";

    const blob = new Blob([exportText], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${safeName}.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  async function copyShareLink() {
    if (!deck) return;

    try {
      const shareUrl = `${window.location.origin}/decks/${deck.id}`;

      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);

      window.setTimeout(() => {
        setShareCopied(false);
      }, 1800);
    } catch (error) {
      console.error("Erro ao copiar link:", error);
      setErrorMessage("Não foi possível copiar o link do deck.");
    }
  }

  async function deleteDeck() {
    if (!deck || !isOwner) return;

    setDeleting(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("decks")
      .delete()
      .eq("id", deck.id)
      .eq("owner_id", deck.owner_id);

    if (error) {
      console.error("Erro ao excluir deck:", error);
      setErrorMessage(`Erro: ${error.message}`);
      setDeleting(false);
      setDeleteDeckOpen(false);
      return;
    }

    router.push("/meus-decks");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-[#f4f1e8]">
        <p className="text-sm text-white/40">Carregando deck...</p>
      </main>
    );
  }

  if (!deck) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6 text-[#f4f1e8]">
        <div className="text-center">
          <p className="text-white/60">
            {errorMessage || "Deck não encontrado."}
          </p>

          <Link
            href="/meus-decks"
            className="mt-5 inline-block text-sm text-white/40 transition hover:text-white"
          >
            ← Voltar para meus decks
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-3 py-8 text-[#f4f1e8] md:px-4 xl:px-5">
      <div className={editing ? "mx-auto w-full max-w-4xl" : "w-full"}>
        {editing ? (
          <button
            type="button"
            onClick={cancelEditing}
            className="text-sm text-white/40 transition hover:text-white"
          >
            ← Voltar para o deck
          </button>
        ) : (
          <Link
            href={isOwner ? "/meus-decks" : "/"}
            className="text-sm text-white/40 transition hover:text-white"
          >
            {isOwner ? "← Meus decks" : "← CurveOut"}
          </Link>
        )}

        <header className="relative mt-10 overflow-visible border-b border-white/10 pb-16">
          {!editing && (
            <>
              <div
                className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.22]"
                style={{
                  backgroundImage: `url("${deckArt}")`,
                }}
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b0b0d]/70 via-[#0b0b0d]/88 to-[#0b0b0d]" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-transparent to-[#0b0b0d]/60" />
            </>
          )}

          <div className="relative z-10">
          {!editing ? (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/35">
                  {deck.format}
                </p>

                <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
                  {deck.name}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/40">
                  <span>{deck.is_public ? "Público" : "Privado"}</span>

                  {!isOwner && (
                    <>
                      <span>•</span>

                      <span
                        className="
                          rounded-full
                          border border-white/10
                          bg-black/20
                          px-2.5 py-1
                          text-[11px]
                          text-white/35
                        "
                      >
                        Modo leitura
                      </span>
                    </>
                  )}

                  <span>•</span>

                  <span>{deckCardTotal} cartas</span>

                  <span>•</span>

                  <div ref={priceMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setPriceOpen((current) => !current)}
                      className="
                        flex items-center gap-1.5
                        text-white/45
                        transition
                        hover:text-white/80
                      "
                    >
                      <span>R$ —</span>

                      <span
                        className={`
                          inline-block text-[10px] transition-transform
                          ${priceOpen ? "rotate-180" : ""}
                        `}
                      >
                        ▼
                      </span>
                    </button>

                    {priceOpen && (
                      <div
                        className="
                          absolute left-0 top-full z-30 mt-3
                          w-56 overflow-hidden
                          rounded-xl
                          border border-white/10
                          bg-[#111114]/95
                          p-2
                          shadow-2xl
                          backdrop-blur-xl
                        "
                      >
                        <div className="rounded-lg px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-white/25">
                            Preço mínimo
                          </p>

                          <p className="mt-1 text-sm font-medium text-white/70">
                            R$ —
                          </p>
                        </div>

                        <div className="rounded-lg border-t border-white/10 px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-white/25">
                            Preço médio
                          </p>

                          <p className="mt-1 text-sm font-medium text-white/70">
                            R$ —
                          </p>
                        </div>

                        <div className="rounded-lg border-t border-white/10 px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-white/25">
                            Preço máximo
                          </p>

                          <p className="mt-1 text-sm font-medium text-white/70">
                            R$ —
                          </p>
                        </div>

                        <p className="px-3 pb-2 pt-1 text-[11px] leading-4 text-white/20">
                          Os valores aparecerão quando o deck tiver cartas com
                          preços disponíveis.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-xs text-white/25">
                  Atualizado em{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(deck.updated_at))}
                </p>

                {deck.description && (
                  <p
                    className="
                      mt-4 max-w-3xl
                      whitespace-pre-wrap
                      break-words
                      [overflow-wrap:anywhere]
                      text-sm leading-6
                      text-white/45
                    "
                  >
                    {truncateText(deck.description, 500)}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {isOwner && (
                    <>
                      <button
                        type="button"
                        onClick={startEditing}
                        className="
                          rounded-lg
                          border border-white/15
                          bg-black/20
                          px-4 py-2
                          text-sm text-white/60
                          backdrop-blur-sm
                          transition
                          hover:border-white/30
                          hover:bg-black/30
                          hover:text-white
                        "
                      >
                        Editar deck
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportDeckOpen(true)}
                        className="
                          rounded-lg
                          border border-white/15
                          bg-black/20
                          px-4 py-2
                          text-sm text-white/60
                          backdrop-blur-sm
                          transition
                          hover:border-white/30
                          hover:bg-black/30
                          hover:text-white
                        "
                      >
                        Importar deck
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setExportCopied(false);
                      setExportDeckOpen(true);
                    }}
                    className="
                      rounded-lg
                      border border-white/15
                      bg-black/20
                      px-4 py-2
                      text-sm text-white/60
                      backdrop-blur-sm
                      transition
                      hover:border-white/30
                      hover:bg-black/30
                      hover:text-white
                    "
                  >
                    Exportar
                  </button>

                  {(deck.is_public || isOwner) && (
                    <button
                      type="button"
                      onClick={() => {
                        setShareCopied(false);
                        setShareDeckOpen(true);
                      }}
                      className="
                        rounded-lg
                        border border-white/15
                        bg-black/20
                        px-4 py-2
                        text-sm text-white/60
                        backdrop-blur-sm
                        transition
                        hover:border-white/30
                        hover:bg-black/30
                        hover:text-white
                      "
                    >
                      Compartilhar
                    </button>
                  )}

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setUpdateDeckOpen(true)}
                      className="
                        rounded-lg
                        border border-white/20
                        bg-[#f4f1e8]
                        px-4 py-2
                        text-sm font-semibold
                        text-black
                        transition
                        hover:bg-white
                      "
                    >
                      Atualizar deck
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl">
              <p className="text-xs uppercase tracking-[0.22em] text-white/30">
                Editar deck
              </p>

              <div className="mt-8">
                <label
                  htmlFor="deck-name"
                  className="text-sm font-medium text-white/70"
                >
                  Nome do deck
                </label>

                <input
                  id="deck-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  className="
                    mt-3
                    w-full
                    rounded-xl
                    border border-white/10
                    bg-white/[0.035]
                    px-4 py-3.5
                    text-[#f4f1e8]
                    outline-none
                    transition
                    focus:border-white/30
                  "
                />

                <div className="mt-2 text-right text-xs text-white/20">
                  {name.length}/80
                </div>
              </div>

              <div className="mt-7">
                <label
                  className="text-sm font-medium text-white/70"
                >
                  Formato
                </label>

                <div className="mt-3">
                  <CurveOutSelect
                    value={format}
                    onChange={setFormat}
                    options={formats}
                  />
                </div>
              </div>

              <div className="mt-7">
                <p className="text-sm font-medium text-white/70">
                  Visibilidade
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`
                      rounded-xl border p-4 text-left transition
                      ${
                        isPublic
                          ? "border-white/30 bg-white/[0.07]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }
                    `}
                  >
                    <p className="font-medium text-white/85">Público</p>

                    <p className="mt-1 text-sm leading-6 text-white/35">
                      Outros usuários poderão visualizar este deck.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`
                      rounded-xl border p-4 text-left transition
                      ${
                        !isPublic
                          ? "border-white/30 bg-white/[0.07]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }
                    `}
                  >
                    <p className="font-medium text-white/85">Privado</p>

                    <p className="mt-1 text-sm leading-6 text-white/35">
                      Somente você poderá visualizar este deck.
                    </p>
                  </button>
                </div>
              </div>

              <div className="mt-7">
                <label
                  htmlFor="deck-description"
                  className="text-sm font-medium text-white/70"
                >
                  Notas do deck
                </label>

                <textarea
                  id="deck-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                  rows={5}
                  placeholder="Ex: testar menos terrenos, trocar pacote de remoções..."
                  className="
                    mt-3
                    w-full
                    resize-none
                    rounded-xl
                    border border-white/10
                    bg-white/[0.035]
                    px-4 py-3.5
                    text-[#f4f1e8]
                    outline-none
                    transition
                    placeholder:text-white/20
                    focus:border-white/30
                  "
                />

                <div className="mt-2 text-right text-xs text-white/20">
                  {description.length}/500
                </div>
              </div>

              {errorMessage && (
                <p className="mt-6 text-sm text-red-300">
                  {errorMessage}
                </p>
              )}

              <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-7">
                <button
                  type="button"
                  onClick={saveDeck}
                  disabled={saving || !name.trim()}
                  className="
                    rounded-lg
                    bg-[#f4f1e8]
                    px-6 py-2.5
                    text-sm font-semibold
                    text-black
                    transition
                    hover:bg-white
                    disabled:cursor-not-allowed
                    disabled:opacity-35
                  "
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>

              <div className="mt-10 rounded-xl border border-red-400/15 bg-red-400/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-red-300/60">
                  Zona de perigo
                </p>

                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/70">
                      Excluir deck
                    </p>

                    <p className="mt-1 max-w-xl text-sm leading-6 text-white/30">
                      Exclui este deck permanentemente. Esta ação não pode ser
                      desfeita.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeleteDeckOpen(true)}
                    className="
                      shrink-0
                      rounded-lg
                      border border-red-300/20
                      px-4 py-2.5
                      text-sm text-red-200/70
                      transition
                      hover:border-red-300/40
                      hover:bg-red-300/[0.06]
                      hover:text-red-100
                    "
                  >
                    Excluir deck
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </header>

        {!editing && errorMessage && (
          <p className="mt-6 text-sm text-red-300">
            {errorMessage}
          </p>
        )}

        {!editing && (
          <section className="pt-10 pb-8">
            {/* BARRA DO DECK */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.015]">
              <div className="overflow-visible border-b border-white/10">
                <div
                  className={`
                    relative z-20
                    grid min-w-[1100px] gap-3 p-3
                    ${
                      isOwner
                        ? "grid-cols-[1.5fr_0.75fr_0.75fr_1.25fr]"
                        : "grid-cols-[0.75fr_0.75fr_1.5fr]"
                    }
                  `}
                >
                {/* PROCURAR / ADICIONAR CARTA */}
                {isOwner && (
                  <div>
                  <label
                    htmlFor="card-search"
                    className="mb-2 block px-1 text-[11px] uppercase tracking-[0.16em] text-white/25"
                  >
                    Adicionar carta
                  </label>

                  <div className="relative">
                    <input
                      id="card-search"
                      type="search"
                      value={cardSearch}
                      autoComplete="off"
                      onFocus={() => {
                        if (cardSearchResults.length > 0) {
                          setCardSearchOpen(true);
                        }
                      }}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setCardSearch(nextValue);
                        setCardSearchError("");
                        setCardSearchStatus("");

                        if (nextValue.trim().length < 2) {
                          setCardSearchResults([]);
                          setCardSearchOpen(false);
                          setHighlightedCardIndex(0);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setCardSearchOpen(false);
                          return;
                        }

                        if (event.key === "ArrowDown" && cardSearchResults.length > 0) {
                          event.preventDefault();
                          setCardSearchOpen(true);
                          setHighlightedCardIndex((current) =>
                            Math.min(current + 1, cardSearchResults.length - 1)
                          );
                          return;
                        }

                        if (event.key === "ArrowUp" && cardSearchResults.length > 0) {
                          event.preventDefault();
                          setCardSearchOpen(true);
                          setHighlightedCardIndex((current) =>
                            Math.max(current - 1, 0)
                          );
                          return;
                        }

                        if (event.key === "Enter" && cardSearchOpen && cardSearchResults.length > 0) {
                          event.preventDefault();
                          const selected = cardSearchResults[highlightedCardIndex];
                          if (selected) {
                            void addCardToDeck(selected);
                          }
                        }
                      }}
                      placeholder="Procurar carta..."
                      className="
                        w-full rounded-xl
                        border border-white/10
                        bg-[#0f0f12]
                        px-4 py-3 pr-10
                        text-sm text-white
                        outline-none transition
                        placeholder:text-white/25
                        focus:border-white/30
                      "
                    />

                    <span className="pointer-events-none absolute right-4 top-[23px] -translate-y-1/2 text-white/25">
                      {cardSearchLoading || addingCard ? "…" : "⌕"}
                    </span>

                    {cardSearchOpen && cardSearchResults.length > 0 && (
                      <div
                        className="
                          absolute left-0 right-0 top-full z-50 mt-2
                          max-h-80 overflow-y-auto rounded-xl
                          border border-white/10 bg-[#111114]/95
                          p-1.5 shadow-2xl backdrop-blur-xl
                        "
                      >
                        {cardSearchResults.map((suggestion, index) => (
                          <button
                            key={suggestion}
                            type="button"
                            onMouseEnter={() => setHighlightedCardIndex(index)}
                            onClick={() => {
                              void addCardToDeck(suggestion);
                            }}
                            className={`
                              block w-full rounded-lg px-3 py-2.5 text-left text-sm transition
                              ${
                                highlightedCardIndex === index
                                  ? "bg-white/[0.09] text-white"
                                  : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                              }
                            `}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}

                    {cardSearchError && (
                      <p className="mt-2 px-1 text-[11px] text-red-300/70">
                        {cardSearchError}
                      </p>
                    )}

                    {cardSearchStatus && (
                      <p className="mt-2 px-1 text-[11px] text-emerald-300/70">
                        {cardSearchStatus}
                      </p>
                    )}
                  </div>
                </div>
                )}

                {/* ORGANIZAR POR */}
                <div>
                  <label
                    className="mb-2 block px-1 text-[11px] uppercase tracking-[0.16em] text-white/25"
                  >
                    Organizar por
                  </label>

                  <CurveOutSelect
                    value={organizeBy}
                    onChange={(value) => setOrganizeBy(value as OrganizeBy)}
                    options={[
                      "Categoria",
                      "Cor",
                      "Identidade de cor",
                      "Nome",
                      "Tipo",
                    ]}
                  />
                </div>

                {/* EXIBIÇÃO */}
                <div>
                  <label
                    className="mb-2 block px-1 text-[11px] uppercase tracking-[0.16em] text-white/25"
                  >
                    Exibição
                  </label>

                  <CurveOutSelect
                    value={viewMode}
                    onChange={setViewMode}
                    options={[
                      "Stack",
                      "Linha",
                      "Texto",
                    ]}
                  />
                </div>

                {/* PROCURAR NO DECK */}
                <div>
                  <label
                    htmlFor="deck-search"
                    className="mb-2 block px-1 text-[11px] uppercase tracking-[0.16em] text-white/25"
                  >
                    Procurar no deck
                  </label>

                  <div className="relative">
                    <input
                      id="deck-search"
                      type="search"
                      value={deckSearch}
                      onChange={(event) => setDeckSearch(event.target.value)}
                      placeholder="Buscar neste deck..."
                      className="
                        w-full rounded-xl
                        border border-white/10
                        bg-[#0f0f12]
                        px-4 py-3 pr-10
                        text-sm text-white
                        outline-none transition
                        placeholder:text-white/25
                        focus:border-white/30
                      "
                    />

                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/25">
                      ⌕
                    </span>
                  </div>
                </div>
              </div>
              </div>

              {/* ÁREA DAS CARTAS */}
              <div className="min-h-[420px] px-5 py-4 md:px-6 lg:px-8">
                {deckCards.length === 0 ? (
                  <div className="max-w-xl py-2">
                    <p className="text-lg text-white/55">
                      {isOwner
                        ? "Seu deck está vazio."
                        : "Este deck está vazio."}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-white/30">
                      {isOwner
                        ? "Adicione cartas para começar a montar o deck."
                        : "O autor ainda não adicionou cartas a este deck."}
                    </p>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setImportDeckOpen(true)}
                        className="
                          mt-6 rounded-lg bg-[#f4f1e8]
                          px-6 py-2.5 text-sm font-semibold
                          text-black transition hover:bg-white
                        "
                      >
                        Importar cartas
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-white/25">
                          Lista do deck
                        </p>

                        <p className="mt-1 text-sm text-white/40">
                          {visibleDeckCards.length} entrada(s) · {deckCardTotal} cartas
                        </p>
                      </div>
                    </div>

                    <div
                      className="
  w-full overflow-x-hidden pb-6
  [zoom:0.69]
  xl:[zoom:0.75]
  2xl:[zoom:0.95]
"
                    >
                      <div className="flex min-w-max items-start justify-start gap-2 px-1 pt-1">
                        {deckCardsByType.map((group) => (
                          <section
                            key={group.name}
                            className="
                              w-[215px]
                              shrink-0
                              lg:w-[225px]
                              xl:w-[240px]
                              2xl:w-[255px]
                            "
                          >
                            <div className="mb-3 border-b border-white/10 pb-2">
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                                  {group.name}
                                </h3>

                                <span className="text-xs text-white/30">
                                  {group.quantity}
                                </span>
                              </div>
                            </div>

                            <div className="relative min-h-[460px]">
                              {group.cards.map((row, index) => {
                                const image = getProxiedCardImage(row.card);

                                return (
                                  <div
                                    key={`${row.scryfall_id}-${row.board}`}
                                    onClick={() => setSelectedCard(row)}
                                    className="
                                      group/card
                                      relative
                                      mx-auto
                                      w-[208px]
                                      lg:w-[218px]
                                      xl:w-[233px]
                                      2xl:w-[248px]
                                      transition-all
                                      duration-200
                                      ease-out
                                      hover:z-40
                                      hover:mb-[220px]
                                    "
                                    style={{
                                      marginTop: index === 0 ? 0 : -220,
                                    }}
                                  >
                                    <div
                                      className="
                                        relative
                                        overflow-hidden
                                        rounded-[9px]
                                        border border-white/10
                                        bg-[#151518]
                                        shadow-lg shadow-black/30
                                        transition
                                        duration-200
                                        group-hover/card:-translate-y-1
                                        group-hover/card:border-white/30
                                      "
                                    >
                                      {image ? (
                                        <img
                                          src={image}
                                          alt={row.card?.name ?? "Carta"}
                                          className="block aspect-[63/88] w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex aspect-[63/88] flex-col justify-start bg-[#17171a]">
                                          <div className="border-b border-white/10 px-3 py-2">
                                            <p className="truncate text-xs font-medium text-white/75">
                                              {row.card?.name ??
                                                `Carta ${row.scryfall_id.slice(0, 8)}…`}
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                      {/* QUANTIDADE NORMAL */}
                                      <span
                                        className="
                                          absolute right-1 top-1
                                          rounded-md
                                          bg-black/80
                                          px-1.5 py-0.5
                                          text-[10px] font-semibold text-white/85
                                          transition
                                          group-hover/card:opacity-0
                                        "
                                      >
                                        {row.quantity}
                                      </span>

                                      {/* CONTROLES NO HOVER */}
                                      <div
                                        className="
                                          absolute bottom-1.5 left-1/2
                                          flex -translate-x-1/2 items-center gap-1.5
                                          opacity-0
                                          transition
                                          group-hover/card:opacity-100
                                        "
                                      >
                                        {isOwner && (
                                          <div
                                            className="
                                              flex items-center gap-2
                                              rounded-lg
                                              border border-white/10
                                              bg-black/90
                                              px-2 py-1
                                              shadow-lg shadow-black/40
                                              backdrop-blur-sm
                                            "
                                          >
                                            <button
                                              type="button"
                                              aria-label={`Aumentar quantidade de ${
                                                row.card?.name ?? "carta"
                                              }`}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                void increaseCardQuantity(row);
                                              }}
                                              className="
                                                flex h-6 w-6 items-center justify-center
                                                rounded-md
                                                text-sm font-semibold text-white/75
                                                transition
                                                hover:bg-white/10
                                                hover:text-white
                                              "
                                            >
                                              +
                                            </button>

                                            <span className="min-w-5 text-center text-xs font-semibold text-white">
                                              {row.quantity}
                                            </span>

                                            <button
                                              type="button"
                                              aria-label={`Diminuir quantidade de ${
                                                row.card?.name ?? "carta"
                                              }`}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                void decreaseCardQuantity(row);
                                              }}
                                              className="
                                                flex h-6 w-6 items-center justify-center
                                                rounded-md
                                                text-sm font-semibold text-white/75
                                                transition
                                                hover:bg-white/10
                                                hover:text-white
                                              "
                                            >
                                              −
                                            </button>
                                          </div>
                                        )}

                                        <button
                                          type="button"
                                          aria-label="Mais opções da carta"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setSelectedCard(row);
                                          }}
                                          className="
                                            flex h-8 w-8 items-center justify-center
                                            rounded-lg
                                            border border-white/10
                                            bg-black/90
                                            text-lg leading-none text-white/65
                                            shadow-lg shadow-black/40
                                            backdrop-blur-sm
                                            transition
                                            hover:bg-[#202024]
                                            hover:text-white
                                          "
                                        >
                                          ⋯
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>

                    {visibleDeckCards.length === 0 && (
                      <p className="py-12 text-sm text-white/30">
                        Nenhuma carta encontrada para essa busca.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {selectedCard && (
  <div
    className="
      fixed inset-0 z-[100]
      flex items-center justify-center
      bg-black/80
      px-4 py-6
      backdrop-blur-md
    "
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        setSelectedCard(null);
      }
    }}
  >
    <div
      className="
        relative
        w-full max-w-6xl
        overflow-hidden
        rounded-[24px]
        border border-white/10
        bg-[#0d0d10]
        shadow-2xl
      "
    >
      {/* TOPO */}
      <div className="flex items-start justify-between gap-6 border-b border-white/10 px-8 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/25">
            Detalhes da carta
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            {selectedCard.card?.name ?? "Carta"}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setSelectedCard(null)}
          className="
            flex h-9 w-9 items-center justify-center
            rounded-xl
            border border-white/10
            text-lg text-white/40
            transition
            hover:border-white/20
            hover:bg-white/5
            hover:text-white
          "
        >
          ×
        </button>
      </div>

      {/* CONTEÚDO */}
      <div
        className="
          grid
          items-center
          gap-6
          px-8 py-7
          lg:grid-cols-[1fr_350px_1fr]
        "
      >
        {/* LADO ESQUERDO */}
        <div className="space-y-8 pr-10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Impressão
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm font-medium text-white/75">
                Edição atual
              </p>

              <p className="mt-1 text-xs text-white/30">
                Dados da impressão entram aqui
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Coleção
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm text-white/65">
                Set · #000
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Idioma
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm text-white/65">
                Inglês
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Compra aqui
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm text-white/65">
                Ver na LigaMagic
              </p>
            </div>
          </div>
        </div>

        {/* CARTA CENTRAL */}
        <div className="flex flex-col items-center">
          <div
            className="
              relative
              w-full max-w-[330px]
              overflow-hidden
              rounded-[14px]
              border border-white/10
              bg-[#151518]
              shadow-2xl shadow-black/50
            "
          >
            {getProxiedCardImage(selectedCard.card) ? (
              <img
                src={getProxiedCardImage(selectedCard.card) ?? ""}
                alt={selectedCard.card?.name ?? "Carta"}
                className="block aspect-[63/88] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[63/88] items-center justify-center px-6 text-center">
                <p className="text-sm text-white/35">
                  Imagem indisponível
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setPrintingPickerOpen(true);
              void loadCardPrintings(selectedCard);
            }}
            className="
              mt-5
              rounded-xl
              border border-white/10
              px-5 py-2.5
              text-xs font-medium
              text-white/50
              transition
              hover:border-white/20
              hover:bg-white/5
              hover:text-white
            "
          >
            Trocar impressão
          </button>
        </div>

        {/* LADO DIREITO */}
        <div className="space-y-8 pl-10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              No deck
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm font-medium text-white/75">
                Quantidade
              </p>

              <div className="mt-3 flex items-center gap-3">
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      void decreaseCardQuantity(selectedCard);
                    }}
                    className="
                      flex h-8 w-8 items-center justify-center
                      rounded-lg
                      border border-white/10
                      text-white/60
                      transition
                      hover:bg-white/5
                      hover:text-white
                    "
                  >
                    −
                  </button>
                )}

                <input
                  type="number"
                  min={1}
                  value={selectedCardQuantity}
                  onChange={(event) => {
                    setSelectedCardQuantity(event.target.value);
                  }}
                  onBlur={() => {
                    const quantity = Number(selectedCardQuantity);

                    if (!Number.isFinite(quantity) || quantity < 1) {
                      setSelectedCardQuantity(
                        String(selectedCard.quantity)
                      );
                      return;
                    }

                    void setCardQuantity(selectedCard, quantity);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  className="
                    h-8 w-14
                    rounded-lg
                    border border-white/10
                    bg-transparent
                    text-center
                    text-base font-semibold
                    text-white
                    outline-none
                    transition
                    focus:border-white/30
                    [&::-webkit-inner-spin-button]:appearance-none
                    [&::-webkit-outer-spin-button]:appearance-none
                  "
                />

                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      void increaseCardQuantity(selectedCard);
                    }}
                    className="
                      flex h-8 w-8 items-center justify-center
                      rounded-lg
                      border border-white/10
                      text-white/60
                      transition
                      hover:bg-white/5
                      hover:text-white
                    "
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Posição
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm text-white/65">
                {selectedCard.board === "commander"
                  ? "Comandante"
                  : selectedCard.board === "sideboard"
                    ? "Sideboard"
                    : selectedCard.board === "maybeboard"
                      ? "Maybeboard"
                      : "Mainboard"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Tipo
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm text-white/65">
                {selectedCard.card?.type_line ?? "—"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Preço
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm text-white/65">
                R$ —
              </p>

              <p className="mt-1 text-xs text-white/25">
                Preços da LigaMagic entram aqui depois
              </p>
            </div>
          </div>
        </div>
      </div>
      {printingPickerOpen && (
        <div
          className="
            absolute inset-0 z-50
            flex flex-col
            bg-[#0d0d10]/98
            backdrop-blur-xl
          "
        >
          <div
            className="
              flex items-center justify-between
              border-b border-white/10
              px-8 py-5
            "
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">
                Impressões disponíveis
              </p>

              <h3 className="mt-1 text-xl font-semibold">
                {selectedCard.card?.name}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setPrintingPickerOpen(false)}
              className="
                flex h-9 w-9 items-center justify-center
                rounded-xl
                border border-white/10
                text-white/40
                transition
                hover:bg-white/5
                hover:text-white
              "
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-8">
            {printingLoading ? (
              <div className="flex min-h-[350px] items-center justify-center text-sm text-white/35">
                Carregando impressões...
              </div>
            ) : printingError ? (
              <div className="flex min-h-[350px] items-center justify-center text-sm text-red-300/70">
                {printingError}
              </div>
            ) : printingOptions.length === 0 ? (
              <div className="flex min-h-[350px] items-center justify-center text-sm text-white/35">
                Nenhuma outra impressão encontrada.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {printingOptions.map((printing) => {
                  const selected =
                    printing.scryfall_id === selectedCard.scryfall_id;

                  const image =
                    printing.image_uri_large ?? printing.image_uri;

                  return (
                    <button
                      key={printing.scryfall_id}
                      type="button"
                      disabled={changingPrinting}
                      onClick={() => {
                        void changeCardPrinting(printing);
                      }}
                      className={`
                        group rounded-xl border p-3 text-left transition
                        ${
                          selected
                            ? "border-white/35 bg-white/[0.07]"
                            : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]"
                        }
                        disabled:cursor-wait
                        disabled:opacity-60
                      `}
                    >
                      <div className="overflow-hidden rounded-[9px] bg-black/30">
                        {image ? (
                          <img
                            src={`/api/scryfall/image?url=${encodeURIComponent(
                              image
                            )}`}
                            alt={printing.name}
                            className="aspect-[63/88] w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-[63/88] items-center justify-center text-xs text-white/25">
                            Sem imagem
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-white/75">
                            {printing.set_name}
                          </p>

                          {selected && (
                            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-black">
                              ATUAL
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-white/30">
                          {printing.set} · #{printing.collector_number} ·{" "}
                          {printing.lang}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  </div>
)}

      {shareDeckOpen && (
        <div
          className="
            fixed inset-0 z-[80]
            flex items-center justify-center
            bg-black/80
            px-4 py-6
            backdrop-blur-sm
          "
         onMouseDown={(event) => {
  if (event.target === event.currentTarget) {
    setShareDeckOpen(false);
  }
}}
        >
          <div
            className="
              w-full max-w-xl
              overflow-hidden
              rounded-2xl
              border border-white/15
              bg-[#0f0f12]
              shadow-2xl
            "
          >
            <div className="flex items-start justify-between gap-6 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                  Compartilhar
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  Link do deck
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/40">
                  Copie o endereço desta página para enviar o deck para outra
                  pessoa.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShareDeckOpen(false)}
                className="
                  rounded-lg
                  border border-white/10
                  px-3 py-2
                  text-sm text-white/45
                  transition
                  hover:border-white/25
                  hover:text-white
                "
              >
                Fechar
              </button>
            </div>

            <div className="p-6">
              <div
                className={`
                  rounded-xl
                  border p-4
                  ${
                    deck.is_public
                      ? "border-white/10 bg-white/[0.025]"
                      : "border-amber-200/10 bg-amber-200/[0.025]"
                  }
                `}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white/75">
                      {deck.is_public ? "Deck público" : "Deck privado"}
                    </p>

                    <p className="mt-1 text-sm leading-6 text-white/35">
                      {deck.is_public
                        ? "Qualquer pessoa com este link poderá visualizar o deck em modo leitura."
                        : "Somente você consegue abrir este deck. O link não libera acesso enquanto ele estiver privado."}
                    </p>
                  </div>

                  <span
                    className="
                      shrink-0 rounded-full
                      border border-white/10
                      px-2.5 py-1
                      text-[11px] text-white/35
                    "
                  >
                    {deck.is_public ? "Público" : "Privado"}
                  </span>
                </div>

                {!deck.is_public && isOwner && (
                  <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-white/25">
                    Para compartilhar com outras pessoas, use “Editar deck” e
                    altere a visibilidade para Público.
                  </p>
                )}
              </div>

              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/20">
                  Endereço
                </p>

                <div
                  className="
                    mt-2 flex items-center gap-3
                    rounded-xl
                    border border-white/10
                    bg-[#0b0b0d]
                    px-4 py-3
                  "
                >
                  <p className="min-w-0 flex-1 truncate font-mono text-xs text-white/40">
                    {typeof window !== "undefined"
                      ? `${window.location.origin}/decks/${deck.id}`
                      : `/decks/${deck.id}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-white/10 px-6 py-5">
              <button
                type="button"
                onClick={copyShareLink}
                className="
                  rounded-lg
                  bg-[#f4f1e8]
                  px-5 py-2.5
                  text-sm font-semibold
                  text-black
                  transition
                  hover:bg-white
                "
              >
                {shareCopied ? "Link copiado!" : "Copiar link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {exportDeckOpen && (
        <div
          className="
            fixed inset-0 z-[75]
            flex items-center justify-center
            overflow-y-auto
            bg-black/80
            px-4 py-6
            backdrop-blur-sm
          "
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setExportDeckOpen(false);
            }
          }}
        >
          <div
            className="
              flex max-h-[92vh] w-full max-w-3xl
              flex-col overflow-hidden
              rounded-2xl
              border border-white/15
              bg-[#0f0f12]
              shadow-2xl
            "
          >
            <div className="flex items-start justify-between gap-6 border-b border-white/10 px-6 py-5 md:px-8">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                  Compartilhar lista
                </p>

                <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
                  Exportar deck
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-white/40">
                  Copie apenas a lista no formato “1 Carta” para colar em outro
                  deckbuilder, ou baixe um arquivo .txt.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setExportDeckOpen(false)}
                className="
                  rounded-lg
                  border border-white/10
                  px-3 py-2
                  text-sm text-white/45
                  transition
                  hover:border-white/25
                  hover:text-white
                "
              >
                Fechar
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
              <div
                className="
                  overflow-hidden
                  rounded-xl
                  border border-white/10
                  bg-[#0b0b0d]
                "
              >
                <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-white/25">
                      Lista simples
                    </p>

                    <p className="mt-1 text-xs text-white/20">
                      Formato de texto compatível com copiar e colar.
                    </p>
                  </div>

                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/30">
                    {deckCardTotal} cartas
                  </span>
                </div>

                <pre
                  className="
                    max-h-[420px]
                    overflow-auto
                    whitespace-pre-wrap
                    break-words
                    p-4
                    font-mono
                    text-sm leading-6
                    text-white/60
                  "
                >
                  {exportText}
                </pre>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/20">
                  Copiar cartas
                </p>

                <p className="mt-2 text-xs leading-5 text-white/35">
                  O botão “Copiar cartas” coloca somente as cartas na área de
                  transferência, uma por linha, no formato:
                </p>

                <pre className="mt-3 font-mono text-xs leading-5 text-white/50">{`1 Sol Ring
1 Arcane Signet
4 Forest`}</pre>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <p className="text-xs leading-5 text-white/25">
                  O deck ainda está vazio. Quando as cartas estiverem ligadas
                  ao deck, esta exportação passará a incluir automaticamente
                  quantidade, nome e seções como Commander, Deck e Sideboard.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-end md:px-8">
              <button
                type="button"
                onClick={downloadExportText}
                className="
                  rounded-lg
                  border border-white/15
                  px-4 py-2.5
                  text-sm text-white/55
                  transition
                  hover:border-white/30
                  hover:text-white
                "
              >
                Baixar .txt
              </button>

              <a
                href="https://www.ligamagic.com.br/?view=dks/novo"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  inline-flex items-center justify-center
                  rounded-lg
                  border border-white/15
                  px-4 py-2.5
                  text-sm text-white/55
                  transition
                  hover:border-white/30
                  hover:text-white
                "
              >
                Criar na LigaMagic
              </a>

              <button
                type="button"
                onClick={copyExportText}
                className="
                  rounded-lg
                  bg-[#f4f1e8]
                  px-5 py-2.5
                  text-sm font-semibold
                  text-black
                  transition
                  hover:bg-white
                "
              >
                {exportCopied ? "Copiado!" : "Copiar cartas"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && importDeckOpen && (
        <div
          className="
            fixed inset-0 z-[70]
            flex items-center justify-center
            bg-black/80
            px-4 py-6
            backdrop-blur-sm
          "
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setImportDeckOpen(false);
            }
          }}
        >
          <div
            className="
              flex max-h-[92vh] w-full max-w-6xl
              flex-col overflow-hidden
              rounded-2xl
              border border-white/15
              bg-[#0f0f12]
              shadow-2xl
            "
          >
            {/* CABEÇALHO */}
            <div className="flex items-start justify-between gap-6 border-b border-white/10 px-6 py-5 md:px-8">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                  Lista de cartas
                </p>

                <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
                  Importar deck
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
                  Cole uma lista de cartas. O CurveOut já separa quantidade,
                  nome e seções comuns antes de consultar as cartas.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setImportDeckOpen(false)}
                className="
                  rounded-lg
                  border border-white/10
                  px-3 py-2
                  text-sm text-white/45
                  transition
                  hover:border-white/25
                  hover:text-white
                "
              >
                Fechar
              </button>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_0.9fr]">
              {/* COLAR LISTA */}
              <div className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r lg:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white/70">
                      Cole sua lista
                    </p>

                    <p className="mt-1 text-xs text-white/25">
                      Exemplos: 1 Sol Ring, 1x Arcane Signet, 4 Lightning Bolt
                    </p>
                  </div>

                  {importText && (
                    <button
                      type="button"
                      onClick={() => setImportText("")}
                      className="text-xs text-white/35 transition hover:text-white"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder={`Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring
1 Arcane Signet
1 Command Tower
4 Forest

Sideboard
1 Negate`}
                  spellCheck={false}
                  className="
                    mt-4
                    min-h-[430px] w-full
                    resize-none
                    rounded-xl
                    border border-white/10
                    bg-[#0b0b0d]
                    p-4
                    font-mono text-sm leading-6
                    text-white/75
                    outline-none
                    transition
                    placeholder:text-white/18
                    focus:border-white/25
                  "
                />

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/25">
                  <span>
                    {parsedImport.cards.length} nomes reconhecidos
                  </span>

                  <span>
                    {parsedImport.totalCopies} cartas no total
                  </span>

                  {parsedImport.invalidLines.length > 0 && (
                    <span className="text-amber-200/50">
                      {parsedImport.invalidLines.length} linhas não reconhecidas
                    </span>
                  )}
                </div>
              </div>

              {/* PRÉVIA */}
              <div className="min-h-0 p-6 lg:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white/70">
                      Prévia da importação
                    </p>

                    <p className="mt-1 text-xs text-white/25">
                      Ainda não consultamos o Scryfall nesta etapa.
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-semibold text-white/80">
                      {parsedImport.totalCopies}
                    </p>

                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/20">
                      cartas
                    </p>
                  </div>
                </div>

                <div className="mt-5 max-h-[470px] overflow-y-auto pr-1">
                  {parsedImport.cards.length === 0 ? (
                    <div
                      className="
                        flex min-h-72
                        items-center justify-center
                        rounded-xl
                        border border-dashed border-white/10
                        bg-white/[0.015]
                        px-6 text-center
                      "
                    >
                      <div>
                        <p className="text-white/45">
                          Cole uma lista para visualizar as cartas.
                        </p>

                        <p className="mt-2 text-sm text-white/25">
                          A prévia aparece automaticamente.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {parsedImport.cards.map((card, index) => (
                        <div
                          key={`${card.board}-${card.name}-${index}`}
                          className="
                            flex items-center gap-4
                            rounded-xl
                            border border-white/8
                            bg-white/[0.02]
                            px-4 py-3
                          "
                        >
                          <span
                            className="
                              flex h-8 min-w-8
                              items-center justify-center
                              rounded-lg
                              border border-white/10
                              bg-black/25
                              px-2
                              text-xs font-medium
                              text-white/55
                            "
                          >
                            {card.quantity}x
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-white/70">
                              {card.name}
                            </p>

                            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/20">
                              {card.board === "commander"
                                ? "Comandante"
                                : card.board === "sideboard"
                                  ? "Sideboard"
                                  : card.board === "maybeboard"
                                    ? "Maybeboard"
                                    : "Deck"}
                            </p>
                          </div>
                        </div>
                      ))}

                      {parsedImport.invalidLines.length > 0 && (
                        <div className="mt-5 rounded-xl border border-amber-200/10 bg-amber-200/[0.025] p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-amber-100/40">
                            Linhas não reconhecidas
                          </p>

                          <div className="mt-3 space-y-1.5">
                            {parsedImport.invalidLines.map(
                              (line, index) => (
                                <p
                                  key={`${line}-${index}`}
                                  className="break-words font-mono text-xs text-white/30"
                                >
                                  {line}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RODAPÉ */}
            <div className="flex flex-col gap-4 border-t border-white/10 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8">
              <p className="max-w-2xl text-xs leading-5 text-white/25">
                Nesta etapa o CurveOut já interpreta a lista. A próxima parte
                será resolver cada nome no Scryfall e gravar as cartas em
                deck_cards.
              </p>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setImportDeckOpen(false)}
                  className="
                    rounded-lg
                    px-4 py-2.5
                    text-sm text-white/45
                    transition
                    hover:text-white
                  "
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={parsedImport.cards.length === 0}
                  title="A conexão com o Scryfall será ligada na próxima etapa."
                  className="
                    rounded-lg
                    bg-[#f4f1e8]
                    px-5 py-2.5
                    text-sm font-semibold
                    text-black
                    transition
                    hover:bg-white
                    disabled:cursor-not-allowed
                    disabled:opacity-35
                  "
                >
                  Preparar {parsedImport.totalCopies || ""} cartas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOwner && deleteDeckOpen && (
        <div
          className="
            fixed inset-0 z-[60]
            flex items-center justify-center
            bg-black/80
            px-4 py-6
            backdrop-blur-sm
          "
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteDeckOpen(false);
            }
          }}
        >
          <div
            className="
              w-full max-w-lg
              rounded-2xl
              border border-red-300/15
              bg-[#111114]
              p-6
              shadow-2xl
              md:p-7
            "
          >
            <p className="text-xs uppercase tracking-[0.2em] text-red-300/50">
              Zona de perigo
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Excluir “{deck.name}”?
            </h2>

            <p className="mt-4 text-sm leading-6 text-white/40">
              O deck será removido permanentemente. Quando houver cartas
              vinculadas a ele, elas também serão removidas junto com o deck.
            </p>

            <div className="mt-7 flex justify-end gap-2 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={() => setDeleteDeckOpen(false)}
                disabled={deleting}
                className="
                  rounded-lg
                  px-4 py-2.5
                  text-sm text-white/45
                  transition
                  hover:text-white
                  disabled:opacity-40
                "
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={deleteDeck}
                disabled={deleting}
                className="
                  rounded-lg
                  border border-red-300/20
                  bg-red-300/[0.08]
                  px-4 py-2.5
                  text-sm font-semibold
                  text-red-100
                  transition
                  hover:bg-red-300/[0.13]
                  disabled:cursor-wait
                  disabled:opacity-50
                "
              >
                {deleting ? "Excluindo..." : "Excluir permanentemente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && updateDeckOpen && (
        <div
          className="
            fixed inset-0 z-50
            flex items-center justify-center
            bg-black/75
            px-4 py-6
            backdrop-blur-sm
          "
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setUpdateDeckOpen(false);
            }
          }}
        >
          <div
            className="
              flex max-h-[90vh] w-full max-w-6xl
              flex-col overflow-hidden
              rounded-2xl
              border border-white/15
              bg-[#0f0f12]
              shadow-2xl
            "
          >
            {/* CABEÇALHO */}
            <div className="flex items-start justify-between gap-6 border-b border-white/10 px-6 py-5 md:px-8">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                  Nova versão
                </p>

                <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
                  Atualizar deck
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
                  Escolha quais cartas do deck atual serão levadas para uma
                  nova versão. O deck original continuará intacto.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setUpdateDeckOpen(false)}
                className="
                  rounded-lg
                  border border-white/10
                  px-3 py-2
                  text-sm text-white/45
                  transition
                  hover:border-white/25
                  hover:text-white
                "
              >
                Fechar
              </button>
            </div>

            {/* BARRA DE SELEÇÃO */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4 md:px-8">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled
                  className="
                    rounded-lg
                    border border-white/10
                    px-4 py-2
                    text-sm text-white/25
                    disabled:cursor-not-allowed
                  "
                >
                  Selecionar tudo
                </button>

                <button
                  type="button"
                  disabled
                  className="
                    rounded-lg
                    border border-white/10
                    px-4 py-2
                    text-sm text-white/25
                    disabled:cursor-not-allowed
                  "
                >
                  Limpar seleção
                </button>
              </div>

              <p className="text-sm text-white/30">
                0 de 0 cartas selecionadas
              </p>
            </div>

            {/* ÁREA DAS SEÇÕES */}
            <div className="overflow-y-auto px-6 py-6 md:px-8">
              <div className="grid gap-4 lg:grid-cols-2">
                {[
                  "Criaturas",
                  "Artefatos",
                  "Encantamentos",
                  "Instants / Feitiços",
                  "Planeswalkers",
                  "Lands",
                ].map((section) => (
                  <div
                    key={section}
                    className="
                      rounded-xl
                      border border-white/10
                      bg-white/[0.02]
                      p-5
                    "
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-white/70">
                          {section}
                        </p>

                        <p className="mt-1 text-xs text-white/25">
                          0 cartas
                        </p>
                      </div>

                      <label className="flex cursor-not-allowed items-center gap-2 text-xs text-white/25">
                        <input
                          type="checkbox"
                          disabled
                          className="h-4 w-4"
                        />
                        Selecionar seção
                      </label>
                    </div>

                    <div className="mt-4 rounded-lg border border-dashed border-white/10 px-4 py-5 text-sm text-white/20">
                      As cartas desta seção aparecerão aqui.
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RODAPÉ */}
            <div className="flex flex-col gap-4 border-t border-white/10 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8">
              <p className="text-xs leading-5 text-white/25">
                Quando o deck tiver cartas, elas começarão selecionadas por
                padrão. Você poderá remover cartas individuais ou uma seção
                inteira antes de criar a nova versão.
              </p>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setUpdateDeckOpen(false)}
                  className="
                    rounded-lg
                    px-4 py-2.5
                    text-sm text-white/45
                    transition
                    hover:text-white
                  "
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled
                  className="
                    rounded-lg
                    bg-[#f4f1e8]
                    px-5 py-2.5
                    text-sm font-semibold
                    text-black
                    disabled:cursor-not-allowed
                    disabled:opacity-35
                  "
                >
                  Criar nova versão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}