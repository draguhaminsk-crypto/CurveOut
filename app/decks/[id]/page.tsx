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
  tags?: string[];
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

type DeckBoardTab = "deck" | "sideboard" | "maybeboard";

const boardTabs: Array<{
  id: DeckBoardTab;
  label: string;
}> = [
  { id: "deck", label: "Deck" },
  { id: "sideboard", label: "Sideboard" },
  { id: "maybeboard", label: "Maybeboard" },
];

function getBoardLabel(board: ImportBoard) {
  if (board === "commander") return "Comandante";
  if (board === "sideboard") return "Sideboard";
  if (board === "maybeboard") return "Maybeboard";
  return "Deck principal";
}

function getBoardFromTab(tab: DeckBoardTab): ImportBoard {
  if (tab === "sideboard") return "sideboard";
  if (tab === "maybeboard") return "maybeboard";
  return "mainboard";
}

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
  raw_text?: string;
  colors?: string[];
  color_identity?: string[];
  cmc?: number;
  mana_cost?: string;
  produced_mana?: string[];
  set?: string;
  set_name?: string;
  collector_number?: string;
  lang?: string;
  released_at?: string;
  rarity?: string;
  printing_source?: "exact" | "oracle-fallback";
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
  };
  image_uris?: {
    normal?: string;
    large?: string;
    art_crop?: string;
  };
  card_faces?: {
    image_uris?: {
      normal?: string;
      large?: string;
      art_crop?: string;
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

const updateDeckSectionOrder = [
  "Comandante",
  "Criaturas",
  "Artefatos",
  "Encantamentos",
  "Instants / Feitiços",
  "Planeswalkers",
  "Lands",
  "Outros",
] as const;

type UpdateDeckSection = (typeof updateDeckSectionOrder)[number];

function getUpdateDeckSection(row: DeckCardRow): UpdateDeckSection {
  if (row.board === "commander") return "Comandante";

  const typeLine = row.card?.type_line?.toLocaleLowerCase("pt-BR") ?? "";

  if (typeLine.includes("land")) return "Lands";
  if (typeLine.includes("creature")) return "Criaturas";
  if (typeLine.includes("artifact")) return "Artefatos";
  if (typeLine.includes("enchantment")) return "Encantamentos";
  if (typeLine.includes("planeswalker")) return "Planeswalkers";
  if (typeLine.includes("instant") || typeLine.includes("sorcery")) {
    return "Instants / Feitiços";
  }

  return "Outros";
}

function getDeckCardSelectionKey(row: DeckCardRow) {
  return row.id ?? `${row.scryfall_id}:${row.board}`;
}

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

function getCmcFromCardData(cardData: unknown): number {
  if (!cardData || typeof cardData !== "object") return 0;
  const cmc = (cardData as { cmc?: unknown }).cmc;
  return typeof cmc === "number" && Number.isFinite(cmc) ? cmc : 0;
}

function getManaCostFromCardData(cardData: unknown): string {
  if (!cardData || typeof cardData !== "object") return "";
  const manaCost = (cardData as { mana_cost?: unknown }).mana_cost;
  return typeof manaCost === "string" ? manaCost : "";
}

function getProducedManaFromCardData(cardData: unknown): string[] {
  if (!cardData || typeof cardData !== "object") return [];
  const producedMana = (cardData as { produced_mana?: unknown }).produced_mana;
  if (!Array.isArray(producedMana)) return [];
  return producedMana.filter((color): color is string => typeof color === "string");
}

function getPricesFromCardData(cardData: unknown): ResolvedCard["prices"] {
  if (!cardData || typeof cardData !== "object") return undefined;

  const prices = (cardData as { prices?: unknown }).prices;
  if (!prices || typeof prices !== "object") return undefined;

  const data = prices as {
    usd?: unknown;
    usd_foil?: unknown;
    usd_etched?: unknown;
  };

  return {
    usd: typeof data.usd === "string" ? data.usd : null,
    usd_foil: typeof data.usd_foil === "string" ? data.usd_foil : null,
    usd_etched: typeof data.usd_etched === "string" ? data.usd_etched : null,
  };
}

function getPrintingDataFromCardData(cardData: unknown) {
  if (!cardData || typeof cardData !== "object") {
    return {
      set: undefined,
      set_name: undefined,
      collector_number: undefined,
      lang: undefined,
      released_at: undefined,
      rarity: undefined,
    };
  }

  const data = cardData as {
    set?: unknown;
    set_name?: unknown;
    collector_number?: unknown;
    lang?: unknown;
    released_at?: unknown;
    rarity?: unknown;
  };

  return {
    set: typeof data.set === "string" ? data.set : undefined,
    set_name: typeof data.set_name === "string" ? data.set_name : undefined,
    collector_number:
      typeof data.collector_number === "string"
        ? data.collector_number
        : undefined,
    lang: typeof data.lang === "string" ? data.lang : undefined,
    released_at:
      typeof data.released_at === "string" ? data.released_at : undefined,
    rarity: typeof data.rarity === "string" ? data.rarity : undefined,
  };
}

function formatCardLanguage(lang?: string) {
  const labels: Record<string, string> = {
    en: "Inglês",
    pt: "Português",
    es: "Espanhol",
    fr: "Francês",
    de: "Alemão",
    it: "Italiano",
    ja: "Japonês",
    ko: "Coreano",
    ru: "Russo",
    zhs: "Chinês simplificado",
    zht: "Chinês tradicional",
    he: "Hebraico",
    la: "Latim",
    grc: "Grego antigo",
    ar: "Árabe",
    sa: "Sânscrito",
    ph: "Phyrexiano",
  };

  if (!lang) return "—";
  return labels[lang.toLocaleLowerCase("pt-BR")] ?? lang.toUpperCase();
}

function formatCardReleaseDate(value?: string) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatCardRarity(rarity?: string) {
  const labels: Record<string, string> = {
    common: "Comum",
    uncommon: "Incomum",
    rare: "Rara",
    mythic: "Mítica",
    special: "Especial",
    bonus: "Bônus",
  };

  if (!rarity) return null;
  return labels[rarity.toLocaleLowerCase("pt-BR")] ?? rarity;
}

function parseUsdPrice(value?: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getArtCropFromCardData(cardData: unknown): string | undefined {
  if (!cardData || typeof cardData !== "object") return undefined;

  const data = cardData as {
    image_uris?: unknown;
    card_faces?: unknown;
  };

  if (data.image_uris && typeof data.image_uris === "object") {
    const artCrop = (data.image_uris as { art_crop?: unknown }).art_crop;
    if (typeof artCrop === "string" && artCrop) return artCrop;
  }

  if (Array.isArray(data.card_faces)) {
    for (const face of data.card_faces) {
      if (!face || typeof face !== "object") continue;
      const imageUris = (face as { image_uris?: unknown }).image_uris;
      if (!imageUris || typeof imageUris !== "object") continue;
      const artCrop = (imageUris as { art_crop?: unknown }).art_crop;
      if (typeof artCrop === "string" && artCrop) return artCrop;
    }
  }

  return undefined;
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

  const typeLine = row.card?.type_line?.toLocaleLowerCase("pt-BR") ?? "";
  const oracleText = row.card?.oracle_text?.toLocaleLowerCase("pt-BR") ?? "";

  // No modo Categoria, terreno é SEMPRE Terrenos.
  // Mesmo terrenos que geram muita mana, buscam terrenos ou têm habilidades de ramp
  // não saem desta categoria.
  if (typeLine.includes("land")) {
    return "Terrenos";
  }

  const scores = new Map<string, number>();

  function addScore(category: string, score: number) {
    scores.set(category, Math.max(scores.get(category) ?? 0, score));
  }

  // REMOÇÃO também engloba counters e limpezas de mesa.
  if (
    /counter target spell|counter target activated ability|counter target triggered ability|counter target ability|counter that spell/.test(
      oracleText
    )
  ) {
    addScore("Remoção", 110);
  }

  if (
    /destroy all|exile all|destroy each|exile each|all creatures get -|each creature gets -|each creature gets \+?-[0-9x]/.test(
      oracleText
    )
  ) {
    addScore("Remoção", 108);
  }

  if (
    /destroy target|exile target|target creature gets -|deals? .* damage to target creature|deals? .* damage to any target|return target .* to its owner's hand/.test(
      oracleText
    )
  ) {
    addScore("Remoção", 104);
  }

  // TUTOR.
  if (
    /search your library for .* card|search your library for a card|search your library, then shuffle/.test(
      oracleText
    )
  ) {
    addScore("Tutor", 96);
  }

  // RECURSÃO também engloba reanimação.
  if (
    /return .* from your graveyard to the battlefield|put .* from .* graveyard onto the battlefield|return target creature card from your graveyard to the battlefield|reanimate/.test(
      oracleText
    )
  ) {
    addScore("Recursão", 94);
  }

  if (
    /return .* from your graveyard to your hand|return target .* card from .* graveyard|return up to .* cards? from .* graveyard|put target .* card from your graveyard into your hand/.test(
      oracleText
    )
  ) {
    addScore("Recursão", 92);
  }

  // COMPRA.
  if (
    /draw (a|one|two|three|four|five|six|seven|\d+) cards?|draw cards equal|draw that many cards|draw an additional card|draw a card|investigate/.test(
      oracleText
    )
  ) {
    addScore("Compra", 88);
  }

  // RAMP: somente não-terrenos.
  if (
    /add \{[wubrgc]|add one mana|add two mana|add three mana|add x mana|treasure token|search your library for .* land card|put .* land card onto the battlefield|additional land on each of your turns/.test(
      oracleText
    )
  ) {
    addScore("Ramp", 84);
  }

  // PROTEÇÃO também absorve blink defensivo.
  if (
    /gains? hexproof|gains? indestructible|protection from|phase out|phases out|regenerate|prevent all damage|can't be the target|cannot be the target/.test(
      oracleText
    )
  ) {
    addScore("Proteção", 80);
  }

  if (
    /exile .* you control.*return|exile target .* you control.*return|return that card to the battlefield|return it to the battlefield under its owner's control|exile .* then return/.test(
      oracleText
    )
  ) {
    addScore("Proteção", 76);
  }

  // EVASÃO só quando a carta cria evasão de verdade.
  // Flying, menace, deathtouch etc. escritos apenas como keyword da própria carta
  // não bastam para classificá-la aqui.
  if (
    /can't be blocked|cannot be blocked|target creature gains? flying|target creature gains? menace|creatures you control gain flying|creatures you control gain menace|creatures you control can't be blocked|creatures you control cannot be blocked/.test(
      oracleText
    )
  ) {
    addScore("Evasão", 72);
  }

  // CÓPIA.
  if (
    /copy target|copy .* spell|copy .* ability|create a token that's a copy|create a token that is a copy|copy of|triggers an additional time|trigger an additional time/.test(
      oracleText
    )
  ) {
    addScore("Cópia", 70);
  }

  // ROUBO.
  if (
    /gain control of|control of target|you control enchanted|exchange control/.test(
      oracleText
    )
  ) {
    addScore("Roubo", 68);
  }

  // DRENO.
  if (
    /each opponent loses|target opponent loses|opponents lose|loses? \d+ life|loses? x life/.test(
      oracleText
    )
  ) {
    addScore("Dreno", 66);
  }

  // GANHO DE VIDA. Lifelink sozinho não força a categoria.
  if (/gain \d+ life|gain life|gains? life/.test(oracleText)) {
    addScore("Ganho de vida", 64);
  }

  // MILL.
  if (
    /mill \d|mills? \d|mill cards|put the top .* cards? of .* library into .* graveyard/.test(
      oracleText
    )
  ) {
    addScore("Mill", 62);
  }

  // INFECT / VENENO.
  if (/poison counter|poison counters|poisoned|toxic \d|toxic x/.test(oracleText)) {
    addScore("Infect", 60);
  }

  if (scores.size > 0) {
    return [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  // Fallbacks no estilo Archidekt: se nenhuma função principal foi detectada,
  // criaturas e instantâneas ainda ficam em grupos úteis em vez de virar tudo
  // "Sem categoria".
  if (typeLine.includes("creature")) return "Criaturas";
  if (typeLine.includes("instant")) return "Instantâneas";

  return "Sem categoria";
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

  if (organizeBy === "Categoria") {
    const categoryOrder = [
      "Comandante",
      "Cópia",
      "Criaturas",
      "Dreno",
      "Compra",
      "Evasão",
      "Infect",
      "Instantâneas",
      "Terrenos",
      "Ganho de vida",
      "Mill",
      "Proteção",
      "Ramp",
      "Recursão",
      "Remoção",
      "Roubo",
      "Tutor",
      "Sem categoria",
    ];

    return categoryOrder.filter((groupName) =>
      rows.some((row) => getFunctionalCategory(row) === groupName)
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
  const [deckTags, setDeckTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [movingCardBoard, setMovingCardBoard] = useState(false);
  const [activeBoardTab, setActiveBoardTab] = useState<DeckBoardTab>("deck");

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
  const [statsOpen, setStatsOpen] = useState(true);

  const deckArt = "/hero-bg.jpg";

  const [updateDeckOpen, setUpdateDeckOpen] = useState(false);
  const [updateDeckSelection, setUpdateDeckSelection] = useState<Set<string>>(
    () => new Set()
  );
  const [creatingDeckVersion, setCreatingDeckVersion] = useState(false);
  const [updateDeckError, setUpdateDeckError] = useState("");
  const [importDeckOpen, setImportDeckOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [exportDeckOpen, setExportDeckOpen] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [shareDeckOpen, setShareDeckOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [deleteDeckOpen, setDeleteDeckOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [usdBrlRate, setUsdBrlRate] = useState<number | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState("");
  const priceMenuRef = useRef<HTMLDivElement | null>(null);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const problemsMenuRef = useRef<HTMLDivElement | null>(null);


  function openCardDetails(row: DeckCardRow) {
    setSelectedCardQuantity(String(row.quantity));
    setSelectedCard(row);
    void loadUsdBrlRate();
  }

  useEffect(() => {
    if (!selectedCard) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (printingPickerOpen) {
          setPrintingPickerOpen(false);
          return;
        }

        setPrintingOptions([]);
        setPrintingError("");
        setSelectedCard(null);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedCard, printingPickerOpen]);

  const updateDeckSections = useMemo(() => {
    return updateDeckSectionOrder
      .map((name) => ({
        name,
        cards: deckCards.filter((row) => getUpdateDeckSection(row) === name),
      }))
      .filter((section) => section.cards.length > 0);
  }, [deckCards]);

  const selectedUpdateDeckRows = useMemo(
    () =>
      deckCards.filter((row) =>
        updateDeckSelection.has(getDeckCardSelectionKey(row))
      ),
    [deckCards, updateDeckSelection]
  );

  const selectedUpdateDeckCopies = useMemo(
    () =>
      selectedUpdateDeckRows.reduce(
        (total, row) => total + Math.max(1, row.quantity),
        0
      ),
    [selectedUpdateDeckRows]
  );

  const updateDeckTotalCopies = useMemo(
    () =>
      deckCards.reduce((total, row) => total + Math.max(1, row.quantity), 0),
    [deckCards]
  );

  function openUpdateDeckModal() {
    setUpdateDeckSelection(
      new Set(deckCards.map((row) => getDeckCardSelectionKey(row)))
    );
    setUpdateDeckError("");
    setUpdateDeckOpen(true);
  }

  function toggleUpdateDeckCard(row: DeckCardRow) {
    const key = getDeckCardSelectionKey(row);

    setUpdateDeckSelection((current) => {
      const next = new Set(current);

      if (next.has(key)) next.delete(key);
      else next.add(key);

      return next;
    });
  }

  function setUpdateDeckSectionSelected(
    cards: DeckCardRow[],
    selected: boolean
  ) {
    setUpdateDeckSelection((current) => {
      const next = new Set(current);

      for (const row of cards) {
        const key = getDeckCardSelectionKey(row);
        if (selected) next.add(key);
        else next.delete(key);
      }

      return next;
    });
  }

  async function createDeckVersion() {
    if (
      !deck ||
      !isOwner ||
      creatingDeckVersion ||
      selectedUpdateDeckRows.length === 0
    ) {
      return;
    }

    setCreatingDeckVersion(true);
    setUpdateDeckError("");

    try {
      const selectedCommander = selectedUpdateDeckRows.find(
        (row) => row.board === "commander"
      );

      const now = new Date().toISOString();
      const { data: newDeck, error: newDeckError } = await supabase
        .from("decks")
        .insert({
          owner_id: deck.owner_id,
          name: `${deck.name} — nova versão`,
          format: deck.format,
          is_public: deck.is_public,
          description: deck.description,
          commander_scryfall_id: selectedCommander?.scryfall_id ?? null,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

      if (newDeckError || !newDeck) {
        throw newDeckError ?? new Error("Não foi possível criar o novo deck.");
      }

      if (deckTags.length > 0) {
        const { error: copyTagsError } = await supabase
          .from("decks")
          .update({ tags: deckTags })
          .eq("id", newDeck.id);

        if (copyTagsError) {
          console.warn(
            "Nova versão criada sem copiar as tags:",
            copyTagsError.message
          );
        }
      }

      const rowsToInsert = selectedUpdateDeckRows.map((row) => ({
        deck_id: newDeck.id,
        scryfall_id: row.scryfall_id,
        oracle_id: row.oracle_id,
        quantity: row.quantity,
        board: row.board,
      }));

      const { error: cardsError } = await supabase
        .from("deck_cards")
        .insert(rowsToInsert);

      if (cardsError) {
        await supabase.from("decks").delete().eq("id", newDeck.id);
        throw cardsError;
      }

      setUpdateDeckOpen(false);
      router.push(`/decks/${newDeck.id}`);
    } catch (error) {
      console.error("Erro ao criar nova versão do deck:", error);
      setUpdateDeckError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a nova versão do deck."
      );
    } finally {
      setCreatingDeckVersion(false);
    }
  }

  const parsedImport = useMemo(
    () => parseImportList(importText),
    [importText]
  );

  const primaryDeckCards = useMemo(
    () =>
      deckCards.filter(
        (row) => row.board === "commander" || row.board === "mainboard"
      ),
    [deckCards]
  );

  const boardCounts = useMemo(
    () => ({
      deck: primaryDeckCards.reduce(
        (total, card) => total + Math.max(1, card.quantity),
        0
      ),
      sideboard: deckCards
        .filter((row) => row.board === "sideboard")
        .reduce((total, card) => total + Math.max(1, card.quantity), 0),
      maybeboard: deckCards
        .filter((row) => row.board === "maybeboard")
        .reduce((total, card) => total + Math.max(1, card.quantity), 0),
    }),
    [deckCards, primaryDeckCards]
  );

  const deckCardTotal = boardCounts.deck;

  const activeBoardRows = useMemo(() => {
    if (activeBoardTab === "sideboard") {
      return deckCards.filter((row) => row.board === "sideboard");
    }

    if (activeBoardTab === "maybeboard") {
      return deckCards.filter((row) => row.board === "maybeboard");
    }

    return primaryDeckCards;
  }, [activeBoardTab, deckCards, primaryDeckCards]);

  const activeBoardTitle =
    activeBoardTab === "sideboard"
      ? "Sideboard"
      : activeBoardTab === "maybeboard"
        ? "Maybeboard"
        : "Deck";

  const activeBoardCount =
    activeBoardTab === "sideboard"
      ? boardCounts.sideboard
      : activeBoardTab === "maybeboard"
        ? boardCounts.maybeboard
        : boardCounts.deck;

  const visibleDeckCards = useMemo(() => {
    const search = deckSearch.trim().toLocaleLowerCase("pt-BR");

    if (!search) return activeBoardRows;

    return activeBoardRows.filter((row) => {
      const cardName = row.card?.name ?? row.scryfall_id;
      const typeLine = row.card?.type_line ?? "";
      const oracleText = row.card?.oracle_text ?? "";
      const category = getFunctionalCategory(row);
      const color = getColorGroup(row);
      const identity = getColorIdentityGroup(row);
      const board =
        row.board === "commander"
          ? "comandante commander"
          : row.board === "sideboard"
            ? "sideboard"
            : row.board === "maybeboard"
              ? "maybeboard"
              : "mainboard";

      const haystack = [
        cardName,
        typeLine,
        oracleText,
        category,
        color,
        identity,
        board,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return haystack.includes(search);
    });
  }, [activeBoardRows, deckSearch]);

  const deckStats = useMemo(() => {
    const nonCommanderCards = primaryDeckCards.filter(
      (row) => row.board === "mainboard"
    );
    const nonLandCards = nonCommanderCards.filter(
      (row) => !(row.card?.type_line ?? "").toLocaleLowerCase("pt-BR").includes("land")
    );

    const curve = [0, 0, 0, 0, 0, 0, 0, 0];
    let totalManaValue = 0;
    let totalNonLandCopies = 0;
    let landCount = 0;
    let creatureCount = 0;
    let spellCount = 0;

    const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    const manaSources: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

    for (const row of nonCommanderCards) {
      const typeLine = (row.card?.type_line ?? "").toLocaleLowerCase("pt-BR");
      const quantity = row.quantity;
      const isLand = typeLine.includes("land");
      const isCreature = typeLine.includes("creature");

      if (isLand) landCount += quantity;
      if (isCreature) creatureCount += quantity;
      if (!isLand && !isCreature) spellCount += quantity;

      if (!isLand) {
        const cmc = Math.max(0, row.card?.cmc ?? 0);
        const bucket = cmc >= 7 ? 7 : Math.floor(cmc);
        curve[bucket] += quantity;
        totalManaValue += cmc * quantity;
        totalNonLandCopies += quantity;
      }

      const colors = normalizeColors(row.card?.colors);
      if (colors.length === 0) colorCounts.C += quantity;
      else for (const color of colors) colorCounts[color] += quantity;

      const produced = normalizeColors(row.card?.produced_mana);
      if (produced.length === 0 && isLand) manaSources.C += quantity;
      else for (const color of produced) manaSources[color] += quantity;
    }

    const commander = primaryDeckCards.find((row) => row.board === "commander");
    const commanderIdentity = new Set(normalizeColors(commander?.card?.color_identity));
    const problems: string[] = [];

    if ((deck?.format ?? "").toLocaleLowerCase("pt-BR") === "commander") {
      if (!commander) problems.push("Nenhum comandante definido.");
      if (deckCardTotal !== 100) {
        problems.push(`Deck Commander está com ${deckCardTotal} cartas; o esperado é 100.`);
      }

      const duplicateNames = new Map<string, number>();
      for (const row of primaryDeckCards) {
        const typeLine = (row.card?.type_line ?? "").toLocaleLowerCase("pt-BR");
        const oracleText = (row.card?.oracle_text ?? "").toLocaleLowerCase("pt-BR");
        if (typeLine.includes("basic land")) continue;
        if (oracleText.includes("a deck can have any number of cards named")) continue;
        const key = (row.card?.name ?? row.oracle_id ?? row.scryfall_id).toLocaleLowerCase("pt-BR");
        duplicateNames.set(key, (duplicateNames.get(key) ?? 0) + row.quantity);
      }
      const duplicateCount = [...duplicateNames.values()].filter((count) => count > 1).length;
      if (duplicateCount > 0) problems.push(`${duplicateCount} carta(s) aparecem mais de uma vez.`);

      if (commander && commanderIdentity.size > 0) {
        const outsideIdentity = primaryDeckCards.filter((row) => {
          if (row.board === "commander") return false;
          const identity = normalizeColors(row.card?.color_identity);
          return identity.some((color) => !commanderIdentity.has(color));
        });
        if (outsideIdentity.length > 0) {
          problems.push(`${outsideIdentity.length} carta(s) estão fora da identidade de cor do comandante.`);
        }
      }
    }

    return {
      curve,
      averageManaValue: totalNonLandCopies > 0 ? totalManaValue / totalNonLandCopies : 0,
      landCount,
      creatureCount,
      spellCount,
      colorCounts,
      manaSources,
      problems,
      nonLandCount: nonLandCards.reduce((total, row) => total + row.quantity, 0),
    };
  }, [primaryDeckCards, deckCardTotal, deck?.format]);

  const deckPrice = useMemo(() => {
    let usd = 0;
    let pricedCopies = 0;
    let unpricedCopies = 0;
    const unpricedCards: Array<{
      key: string;
      name: string;
      quantity: number;
      typeLine: string;
    }> = [];

    for (const row of primaryDeckCards) {
      const unitUsd = parseUsdPrice(row.card?.prices?.usd);

      if (unitUsd === null) {
        unpricedCopies += row.quantity;
        unpricedCards.push({
          key:
            row.id ??
            `${row.scryfall_id}:${row.board}:${row.card?.name ?? "card"}`,
          name: row.card?.name ?? row.scryfall_id,
          quantity: row.quantity,
          typeLine: row.card?.type_line ?? "Tipo não identificado",
        });
        continue;
      }

      usd += unitUsd * row.quantity;
      pricedCopies += row.quantity;
    }

    return { usd, pricedCopies, unpricedCopies, unpricedCards };
  }, [primaryDeckCards]);

  const deckPriceBrl = usdBrlRate ? deckPrice.usd * usdBrlRate : null;
  const selectedCardUsd = parseUsdPrice(selectedCard?.card?.prices?.usd);
  const selectedCardBrl =
    selectedCardUsd !== null && usdBrlRate
      ? selectedCardUsd * usdBrlRate
      : null;

  async function loadUsdBrlRate() {
    if (usdBrlRate || fxLoading) return;

    setFxLoading(true);
    setFxError("");

    async function readRate(response: Response) {
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error("Resposta de câmbio inválida.");
      }

      const result = (await response.json()) as {
        rate?: number;
        rates?: { BRL?: number };
        error?: string;
      };

      const rate =
        typeof result.rate === "number"
          ? result.rate
          : typeof result.rates?.BRL === "number"
            ? result.rates.BRL
            : null;

      if (!response.ok || rate === null || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(result.error ?? "Cotação indisponível.");
      }

      return rate;
    }

    try {
      let rate: number | null = null;

      try {
        const localResponse = await fetch("/api/fx/usd-brl", {
          cache: "no-store",
        });
        rate = await readRate(localResponse);
      } catch (localError) {
        console.warn(
          "Rota local de câmbio indisponível; tentando fonte pública:",
          localError
        );

        const publicResponse = await fetch(
          "https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL",
          { cache: "no-store" }
        );
        rate = await readRate(publicResponse);
      }

      setUsdBrlRate(rate);
    } catch (error) {
      console.error("Erro ao carregar cotação USD/BRL:", error);
      setUsdBrlRate(null);
      setFxError("Cotação em reais indisponível no momento.");
    } finally {
      setFxLoading(false);
    }
  }

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

  const cardNavigationOrder = useMemo(
    () => deckCardsByType.flatMap((group) => group.cards),
    [deckCardsByType]
  );

  const selectedCardNavigationIndex = useMemo(() => {
    if (!selectedCard) return -1;

    return cardNavigationOrder.findIndex((row) =>
      row.id && selectedCard.id
        ? row.id === selectedCard.id
        : row.scryfall_id === selectedCard.scryfall_id &&
          row.board === selectedCard.board
    );
  }, [cardNavigationOrder, selectedCard]);

  const hasPreviousSelectedCard = selectedCardNavigationIndex > 0;
  const hasNextSelectedCard =
    selectedCardNavigationIndex >= 0 &&
    selectedCardNavigationIndex < cardNavigationOrder.length - 1;

  function navigateSelectedCard(direction: -1 | 1) {
    if (selectedCardNavigationIndex < 0) return;

    const nextIndex = selectedCardNavigationIndex + direction;

    if (nextIndex < 0 || nextIndex >= cardNavigationOrder.length) {
      return;
    }

    const nextCard = cardNavigationOrder[nextIndex];
    setPrintingPickerOpen(false);
    setPrintingError("");
    openCardDetails(nextCard);
  }

  async function navigatePrintingCard(direction: -1 | 1) {
    if (selectedCardNavigationIndex < 0 || changingPrinting) return;

    const nextIndex = selectedCardNavigationIndex + direction;

    if (nextIndex < 0 || nextIndex >= cardNavigationOrder.length) {
      return;
    }

    const nextCard = cardNavigationOrder[nextIndex];

    setPrintingError("");
    setPrintingOptions([]);
    openCardDetails(nextCard);
    await loadCardPrintings(nextCard);
  }

  useEffect(() => {
    if (!selectedCard) return;

    function handleCardNavigation(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && hasPreviousSelectedCard) {
        event.preventDefault();
        if (printingPickerOpen) {
          void navigatePrintingCard(-1);
        } else {
          navigateSelectedCard(-1);
        }
      }

      if (event.key === "ArrowRight" && hasNextSelectedCard) {
        event.preventDefault();
        if (printingPickerOpen) {
          void navigatePrintingCard(1);
        } else {
          navigateSelectedCard(1);
        }
      }
    }

    window.addEventListener("keydown", handleCardNavigation);

    return () => {
      window.removeEventListener("keydown", handleCardNavigation);
    };
  // As funções de navegação usam os mesmos valores já listados abaixo.
  // Mantemos a lista explícita para evitar recriar o listener a cada render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedCard,
    printingPickerOpen,
    hasPreviousSelectedCard,
    hasNextSelectedCard,
    selectedCardNavigationIndex,
    cardNavigationOrder,
  ]);


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

    const cardsById = new Map<string, ResolvedCard>();

    if (cardsError) {
      console.error("Erro ao carregar dados das cartas:", cardsError);
    } else {
      for (const card of cardData ?? []) {
        cardsById.set(card.scryfall_id, {
          id: card.scryfall_id,
          oracle_id: card.oracle_id ?? undefined,
          name: card.name,
          type_line: card.type_line ?? undefined,
          oracle_text: getOracleTextFromCardData(card.card_data),
          raw_text: JSON.stringify(card.card_data ?? {}).toLocaleLowerCase(
            "pt-BR"
          ),
          colors: getColorsFromCardData(card.card_data),
          cmc: getCmcFromCardData(card.card_data),
          mana_cost: getManaCostFromCardData(card.card_data),
          produced_mana: getProducedManaFromCardData(card.card_data),
          ...getPrintingDataFromCardData(card.card_data),
          printing_source: "exact",
          prices: getPricesFromCardData(card.card_data),
          color_identity: Array.isArray(card.color_identity)
            ? card.color_identity.filter(
                (color): color is string => typeof color === "string"
              )
            : [],
          image_uris:
            card.image_uri || card.image_uri_large || getArtCropFromCardData(card.card_data)
              ? {
                  normal: card.image_uri ?? undefined,
                  large: card.image_uri_large ?? undefined,
                  art_crop: getArtCropFromCardData(card.card_data),
                }
              : undefined,
        });
      }
    }

    // Uma impressão escolhida no Scryfall pode não existir no nosso espelho
    // do Supabase. Nesses casos, buscamos SOMENTE as impressões que faltam
    // pela rota do Scryfall, preservando o scryfall_id exato escolhido.
    const missingScryfallIds = scryfallIds.filter(
      (scryfallId) => !cardsById.has(scryfallId)
    );

    if (missingScryfallIds.length > 0) {
      try {
        const response = await fetch("/api/scryfall/cards", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            identifiers: missingScryfallIds.map((id) => ({ id })),
          }),
        });

        const result = (await response.json()) as {
          cards?: ResolvedCard[];
          error?: string;
        };

        if (!response.ok) {
          console.warn(
            "Não foi possível buscar as impressões ausentes no Scryfall:",
            result.error
          );
        } else {
          for (const card of result.cards ?? []) {
            cardsById.set(card.id, {
              ...card,
              printing_source: "exact",
              raw_text: JSON.stringify(card).toLocaleLowerCase("pt-BR"),
            });
          }
        }
      } catch (fallbackError) {
        console.warn(
          "Erro ao buscar impressões ausentes no Scryfall:",
          fallbackError
        );
      }
    }

    // Se a impressão exata não estiver no nosso espelho e o Scryfall estiver
    // indisponível, usa outra impressão do MESMO oracle_id apenas para exibir
    // nome, imagem, texto e demais dados. O scryfall_id salvo no deck não muda.
    const stillMissingRows = rows.filter(
      (row) => !cardsById.has(row.scryfall_id) && Boolean(row.oracle_id)
    );

    const missingOracleIds = Array.from(
      new Set(
        stillMissingRows
          .map((row) => row.oracle_id)
          .filter((oracleId): oracleId is string => Boolean(oracleId))
      )
    );

    if (missingOracleIds.length > 0) {
      const { data: oracleFallbackData, error: oracleFallbackError } =
        await supabase
          .from("cards")
          .select(
            "scryfall_id, oracle_id, name, type_line, color_identity, card_data, image_uri, image_uri_large"
          )
          .in("oracle_id", missingOracleIds);

      if (oracleFallbackError) {
        console.warn(
          "Não foi possível usar o espelho local por oracle_id:",
          oracleFallbackError
        );
      } else {
        const cardsByOracleId = new Map<
          string,
          NonNullable<typeof oracleFallbackData>[number]
        >();

        for (const card of oracleFallbackData ?? []) {
          if (card.oracle_id && !cardsByOracleId.has(card.oracle_id)) {
            cardsByOracleId.set(card.oracle_id, card);
          }
        }

        for (const row of stillMissingRows) {
          if (!row.oracle_id) continue;

          const fallbackCard = cardsByOracleId.get(row.oracle_id);
          if (!fallbackCard) continue;

          cardsById.set(row.scryfall_id, {
            id: row.scryfall_id,
            oracle_id: fallbackCard.oracle_id ?? undefined,
            name: fallbackCard.name,
            type_line: fallbackCard.type_line ?? undefined,
            oracle_text: getOracleTextFromCardData(fallbackCard.card_data),
            raw_text: JSON.stringify(
              fallbackCard.card_data ?? {}
            ).toLocaleLowerCase("pt-BR"),
            colors: getColorsFromCardData(fallbackCard.card_data),
            cmc: getCmcFromCardData(fallbackCard.card_data),
            mana_cost: getManaCostFromCardData(fallbackCard.card_data),
            produced_mana: getProducedManaFromCardData(
              fallbackCard.card_data
            ),
            ...getPrintingDataFromCardData(fallbackCard.card_data),
            printing_source: "oracle-fallback",
            prices: getPricesFromCardData(fallbackCard.card_data),
            color_identity: Array.isArray(fallbackCard.color_identity)
              ? fallbackCard.color_identity.filter(
                  (color): color is string => typeof color === "string"
                )
              : [],
            image_uris:
              fallbackCard.image_uri ||
              fallbackCard.image_uri_large ||
              getArtCropFromCardData(fallbackCard.card_data)
                ? {
                    normal: fallbackCard.image_uri ?? undefined,
                    large: fallbackCard.image_uri_large ?? undefined,
                    art_crop: getArtCropFromCardData(
                      fallbackCard.card_data
                    ),
                  }
                : undefined,
          });
        }
      }
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

    if (query.length < 2) return;

    let cancelled = false;

    const timeout = window.setTimeout(async () => {
      try {
        setCardSearchLoading(true);
        setCardSearchError("");

        const escapedQuery = query
          .replaceAll("%", "\\%")
          .replaceAll("_", "\\_");

        const { data: startsWithData, error: startsWithError } =
          await supabase
            .from("cards")
            .select("name")
            .ilike("name", `${escapedQuery}%`)
            .order("name", { ascending: true })
            .limit(10);

        if (startsWithError) {
          throw startsWithError;
        }

        const names = new Map<string, string>();

        for (const row of startsWithData ?? []) {
          if (typeof row.name !== "string") continue;
          names.set(row.name.toLocaleLowerCase("pt-BR"), row.name);
        }

        if (names.size < 10) {
          const { data: containsData, error: containsError } =
            await supabase
              .from("cards")
              .select("name")
              .ilike("name", `%${escapedQuery}%`)
              .order("name", { ascending: true })
              .limit(20);

          if (containsError) {
            throw containsError;
          }

          for (const row of containsData ?? []) {
            if (typeof row.name !== "string") continue;

            const key = row.name.toLocaleLowerCase("pt-BR");

            if (!names.has(key)) {
              names.set(key, row.name);
            }

            if (names.size >= 10) break;
          }
        }

        if (cancelled) return;

        const suggestions = Array.from(names.values()).slice(0, 10);

        setCardSearchResults(suggestions);
        setHighlightedCardIndex(0);
        setCardSearchOpen(suggestions.length > 0);

        if (suggestions.length === 0) {
          setCardSearchError("Nenhuma carta encontrada.");
        }
      } catch (error) {
        if (cancelled) return;

        console.error("Erro no autocomplete local de cartas:", error);
        setCardSearchResults([]);
        setCardSearchOpen(false);
        setCardSearchError("Não foi possível pesquisar as cartas.");
      } finally {
        if (!cancelled) {
          setCardSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [cardSearch, supabase]);

  useEffect(() => {
    async function loadDeck() {
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

      let loadedTags: string[] = [];

      const { data: tagsData, error: tagsError } = await supabase
        .from("decks")
        .select("tags")
        .eq("id", data.id)
        .maybeSingle();

      if (tagsError) {
        console.warn(
          "Tags ainda não disponíveis. Rode a migration de tags no Supabase:",
          tagsError.message
        );
      } else if (Array.isArray(tagsData?.tags)) {
        loadedTags = tagsData.tags.filter(
          (tag): tag is string => typeof tag === "string"
        );
      }

      const hydratedDeck: Deck = {
        ...data,
        tags: loadedTags,
      };

      setDeck(hydratedDeck);
      setName(data.name);
      setFormat(data.format);
      setIsPublic(data.is_public);
      setDescription(data.description ?? "");
      setDeckTags(loadedTags);

      setIsOwner(Boolean(user && user.id === data.owner_id));

      await loadDeckCards(data.id);

      setLoading(false);
    }

    if (params.id) {
      loadDeck();
    }
  // loadDeckCards é estável durante esta página; não precisamos reiniciar
  // todo o carregamento apenas porque a função foi recriada no render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, supabase]);


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        priceMenuRef.current &&
        !priceMenuRef.current.contains(event.target as Node)
      ) {
        setPriceOpen(false);
      }

      if (
        problemsMenuRef.current &&
        !problemsMenuRef.current.contains(event.target as Node)
      ) {
        setProblemsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPriceOpen(false);
        setProblemsOpen(false);
      }
    }

    if (priceOpen || problemsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [priceOpen, problemsOpen]);

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

    try {
      const response = await fetch(
        `/api/scryfall/printings?oracle_id=${encodeURIComponent(oracleId)}`,
        {
          cache: "no-store",
        }
      );

      const result = (await response.json()) as {
        printings?: CardPrinting[];
        error?: string;
      };

      if (!response.ok) {
        setPrintingError(
          result.error ?? "Não foi possível carregar as impressões."
        );
        return;
      }

      setPrintingOptions(result.printings ?? []);
    } catch (error) {
      console.error("Erro ao carregar impressões:", error);
      setPrintingError(
        "Não foi possível carregar as impressões desta carta."
      );
    } finally {
      setPrintingLoading(false);
    }
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
        set: printing.set,
        set_name: printing.set_name,
        collector_number: printing.collector_number,
        lang: printing.lang,
        released_at: printing.released_at,
        printing_source: "exact",
        image_uris: {
          normal: printing.image_uri ?? undefined,
          large: printing.image_uri_large ?? undefined,
        },
      },
    };

    setSelectedCardQuantity(String(updatedCard.quantity));
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

  async function setCardAsCommander(row: DeckCardRow) {
    if (!deck || !isOwner || !row.id) return;

    if (row.board === "commander") {
      return;
    }

    const updatedAt = new Date().toISOString();

    try {
      // 1. Guarda o comandante atual, se existir.
      const { data: currentCommanders, error: commanderError } = await supabase
        .from("deck_cards")
        .select("id, scryfall_id, oracle_id, quantity, board")
        .eq("deck_id", deck.id)
        .eq("board", "commander");

      if (commanderError) {
        console.error("Erro ao buscar comandante atual:", commanderError);
        setErrorMessage("Não foi possível alterar o comandante.");
        return;
      }

      // 2. O comandante antigo volta para o mainboard.
      // Se a mesma impressão já estiver no mainboard, junta as quantidades.
      for (const commander of currentCommanders ?? []) {
        if (commander.id === row.id) continue;

        const { data: sameMainboardCard, error: sameMainboardError } =
          await supabase
            .from("deck_cards")
            .select("id, quantity")
            .eq("deck_id", deck.id)
            .eq("scryfall_id", commander.scryfall_id)
            .eq("board", "mainboard")
            .neq("id", commander.id)
            .maybeSingle();

        if (sameMainboardError) {
          console.error(
            "Erro ao verificar comandante no mainboard:",
            sameMainboardError
          );
          setErrorMessage("Não foi possível alterar o comandante.");
          return;
        }

        if (sameMainboardCard) {
          const { error: mergeOldCommanderError } = await supabase
            .from("deck_cards")
            .update({
              quantity:
                sameMainboardCard.quantity + Math.max(1, commander.quantity ?? 1),
            })
            .eq("id", sameMainboardCard.id);

          if (mergeOldCommanderError) {
            console.error(
              "Erro ao juntar o comandante antigo ao mainboard:",
              mergeOldCommanderError
            );
            setErrorMessage("Não foi possível alterar o comandante.");
            return;
          }

          const { error: deleteOldCommanderError } = await supabase
            .from("deck_cards")
            .delete()
            .eq("id", commander.id);

          if (deleteOldCommanderError) {
            console.error(
              "Erro ao remover a linha do comandante antigo:",
              deleteOldCommanderError
            );
            setErrorMessage("Não foi possível alterar o comandante.");
            return;
          }
        } else {
          const { error: moveOldCommanderError } = await supabase
            .from("deck_cards")
            .update({ board: "mainboard" })
            .eq("id", commander.id);

          if (moveOldCommanderError) {
            console.error(
              "Erro ao devolver o comandante antigo ao mainboard:",
              moveOldCommanderError
            );
            setErrorMessage("Não foi possível alterar o comandante.");
            return;
          }
        }
      }

      // 3. Se a carta escolhida tinha mais de uma cópia, preserva as cópias
      // extras na board de origem e usa somente uma como comandante.
      const extraCopies = Math.max(0, row.quantity - 1);
      const extraCopiesBoard: ImportBoard = row.board;

      const { error: setCommanderError } = await supabase
        .from("deck_cards")
        .update({
          board: "commander",
          quantity: 1,
        })
        .eq("id", row.id);

      if (setCommanderError) {
        console.error("Erro ao definir novo comandante:", setCommanderError);
        setErrorMessage("Não foi possível definir esta carta como comandante.");
        return;
      }

      if (extraCopies > 0) {
        const { data: existingMainboardCopy, error: existingCopyError } =
          await supabase
            .from("deck_cards")
            .select("id, quantity")
            .eq("deck_id", deck.id)
            .eq("scryfall_id", row.scryfall_id)
            .eq("board", extraCopiesBoard)
            .maybeSingle();

        if (existingCopyError) {
          console.error(
            "Erro ao verificar cópias extras no mainboard:",
            existingCopyError
          );
        } else if (existingMainboardCopy) {
          await supabase
            .from("deck_cards")
            .update({
              quantity: existingMainboardCopy.quantity + extraCopies,
            })
            .eq("id", existingMainboardCopy.id);
        } else {
          await supabase.from("deck_cards").insert({
            deck_id: deck.id,
            scryfall_id: row.scryfall_id,
            oracle_id: row.oracle_id ?? row.card?.oracle_id ?? null,
            quantity: extraCopies,
            board: extraCopiesBoard,
          });
        }
      }

      // 4. Atualiza também o comandante salvo na tabela decks.
      const { error: updateDeckError } = await supabase
        .from("decks")
        .update({
          commander_scryfall_id: row.scryfall_id,
          updated_at: updatedAt,
        })
        .eq("id", deck.id)
        .eq("owner_id", deck.owner_id);

      if (updateDeckError) {
        console.error("Erro ao atualizar comandante do deck:", updateDeckError);
        setErrorMessage("A carta mudou de posição, mas o deck não foi atualizado.");
      }

      setDeck({
        ...deck,
        commander_scryfall_id: row.scryfall_id,
        updated_at: updatedAt,
      });

      setSelectedCard({
        ...row,
        board: "commander",
        quantity: 1,
      });
      setSelectedCardQuantity("1");

      await loadDeckCards(deck.id);
    } catch (error) {
      console.error("Erro inesperado ao definir comandante:", error);
      setErrorMessage("Não foi possível definir esta carta como comandante.");
    }
  }

  async function moveCardToBoard(
    row: DeckCardRow,
    targetBoard: ImportBoard
  ) {
    if (!deck || !isOwner || !row.id || movingCardBoard) return;
    if (row.board === targetBoard) return;

    if (targetBoard === "commander") {
      setMovingCardBoard(true);
      setErrorMessage("");

      try {
        await setCardAsCommander(row);
        setActiveBoardTab("deck");
      } finally {
        setMovingCardBoard(false);
      }

      return;
    }

    setMovingCardBoard(true);
    setErrorMessage("");

    try {
      const { data: existingTarget, error: existingTargetError } =
        await supabase
          .from("deck_cards")
          .select("id, quantity")
          .eq("deck_id", deck.id)
          .eq("scryfall_id", row.scryfall_id)
          .eq("board", targetBoard)
          .neq("id", row.id)
          .maybeSingle();

      if (existingTargetError) {
        throw existingTargetError;
      }

      if (existingTarget) {
        const { error: mergeError } = await supabase
          .from("deck_cards")
          .update({
            quantity: existingTarget.quantity + Math.max(1, row.quantity),
          })
          .eq("id", existingTarget.id);

        if (mergeError) {
          throw mergeError;
        }

        const { error: deleteSourceError } = await supabase
          .from("deck_cards")
          .delete()
          .eq("id", row.id);

        if (deleteSourceError) {
          throw deleteSourceError;
        }
      } else {
        const { error: moveError } = await supabase
          .from("deck_cards")
          .update({
            board: targetBoard,
          })
          .eq("id", row.id);

        if (moveError) {
          throw moveError;
        }
      }

      const updatedAt = new Date().toISOString();
      const deckPatch =
        row.board === "commander"
          ? {
              commander_scryfall_id: null,
              updated_at: updatedAt,
            }
          : {
              updated_at: updatedAt,
            };

      const { error: deckUpdateError } = await supabase
        .from("decks")
        .update(deckPatch)
        .eq("id", deck.id)
        .eq("owner_id", deck.owner_id);

      if (deckUpdateError) {
        throw deckUpdateError;
      }

      setDeck({
        ...deck,
        commander_scryfall_id:
          row.board === "commander"
            ? null
            : deck.commander_scryfall_id,
        updated_at: updatedAt,
      });

      setSelectedCard(null);
      setPrintingPickerOpen(false);
      setPrintingOptions([]);
      setPrintingError("");

      setActiveBoardTab(
        targetBoard === "sideboard"
          ? "sideboard"
          : targetBoard === "maybeboard"
            ? "maybeboard"
            : "deck"
      );

      await loadDeckCards(deck.id);
    } catch (error) {
      console.error("Erro ao mover carta entre boards:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível mover a carta."
      );
    } finally {
      setMovingCardBoard(false);
    }
  }

  async function saveDeckTags(nextTags: string[]) {
    if (!deck || !isOwner || tagSaving) return;

    const normalizedTags = Array.from(
      new Map(
        nextTags
          .map((tag) => tag.trim().replace(/\s+/g, " "))
          .filter(Boolean)
          .slice(0, 8)
          .map((tag) => [tag.toLocaleLowerCase("pt-BR"), tag.slice(0, 24)])
      ).values()
    );

    setTagSaving(true);
    setErrorMessage("");

    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("decks")
      .update({
        tags: normalizedTags,
        updated_at: updatedAt,
      })
      .eq("id", deck.id)
      .eq("owner_id", deck.owner_id);

    if (error) {
      console.error("Erro ao salvar tags:", error);
      setErrorMessage(
        "Não foi possível salvar as tags. Se ainda não fez isso, rode a migration de tags no Supabase."
      );
      setTagSaving(false);
      return;
    }

    setDeckTags(normalizedTags);
    setDeck({
      ...deck,
      tags: normalizedTags,
      updated_at: updatedAt,
    });
    setTagInput("");
    setTagSaving(false);
  }

  function addDeckTag() {
    const tag = tagInput.trim().replace(/\s+/g, " ");

    if (!tag || deckTags.length >= 8) return;

    const alreadyExists = deckTags.some(
      (current) =>
        current.toLocaleLowerCase("pt-BR") ===
        tag.toLocaleLowerCase("pt-BR")
    );

    if (alreadyExists) {
      setTagInput("");
      return;
    }

    void saveDeckTags([...deckTags, tag.slice(0, 24)]);
  }

  function removeDeckTag(tag: string) {
    void saveDeckTags(deckTags.filter((current) => current !== tag));
  }

  async function toggleDeckVisibility() {
    if (!deck || !isOwner || visibilitySaving) return;

    const nextIsPublic = !deck.is_public;
    const updatedAt = new Date().toISOString();

    setVisibilitySaving(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("decks")
      .update({
        is_public: nextIsPublic,
        updated_at: updatedAt,
      })
      .eq("id", deck.id)
      .eq("owner_id", deck.owner_id);

    if (error) {
      console.error("Erro ao alterar visibilidade:", error);
      setErrorMessage("Não foi possível alterar a visibilidade do deck.");
      setVisibilitySaving(false);
      return;
    }

    setDeck({
      ...deck,
      is_public: nextIsPublic,
      updated_at: updatedAt,
    });
    setIsPublic(nextIsPublic);
    setVisibilitySaving(false);
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
    const destinationBoard = getBoardFromTab(activeBoardTab);

    if (!deck || !isOwner || !cleanName || addingCard) {
      return;
    }

    setAddingCard(true);
    setCardSearchError("");
    setCardSearchStatus(`Adicionando ${cleanName}...`);

    try {
      const { data: localCard, error: localCardError } = await supabase
        .from("cards")
        .select("scryfall_id, oracle_id, name")
        .eq("name", cleanName)
        .limit(1)
        .maybeSingle();

      if (localCardError) {
        throw localCardError;
      }

      if (!localCard) {
        throw new Error("Carta não encontrada no banco local.");
      }

      const card = {
        id: localCard.scryfall_id,
        oracle_id: localCard.oracle_id ?? undefined,
        name: localCard.name,
      };

      const { data: existingCard, error: existingError } = await supabase
        .from("deck_cards")
        .select("id, quantity")
        .eq("deck_id", deck.id)
        .eq("scryfall_id", card.id)
        .eq("board", destinationBoard)
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
            board: destinationBoard,
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
      setCardSearchStatus(
        `${card.name} adicionada em ${getBoardLabel(destinationBoard)} ✓`
      );

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
    setDeckTags(deck.tags ?? deckTags);
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

        <header
          className={`relative mt-10 overflow-visible border-b border-white/10 pb-16 ${
            priceOpen || problemsOpen ? "z-[60]" : "z-40"
          }`}
        >
          {!editing && (
            <div className="pointer-events-none absolute -top-28 bottom-0 left-0 right-0 overflow-hidden">
              <div
                className="
                  absolute
                  -right-8 top-1/2
                  h-[190%] w-[68%]
                  -translate-y-1/2
                  bg-contain bg-right bg-no-repeat
                  opacity-[0.34]
                "
                style={{
                  backgroundImage: `url("${deckArt}")`,
                  WebkitMaskImage:
                    "linear-gradient(to left, black 0%, black 38%, rgba(0,0,0,.78) 60%, rgba(0,0,0,.35) 82%, transparent 100%)",
                  maskImage:
                    "linear-gradient(to left, black 0%, black 38%, rgba(0,0,0,.78) 60%, rgba(0,0,0,.35) 82%, transparent 100%)",
                }}
              />

              <div
                className="
                  absolute inset-0
                  bg-gradient-to-l
                  from-[#0b0b0d]/20
                  via-[#0b0b0d]/58
                  to-[#0b0b0d]
                "
              />

              <div
                className="
                  absolute inset-0
                  bg-gradient-to-t
                  from-[#0b0b0d]
                  via-transparent
                  to-[#0b0b0d]/65
                "
              />
            </div>
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
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        void toggleDeckVisibility();
                      }}
                      disabled={visibilitySaving}
                      title="Clique para alternar a visibilidade"
                      className={`
                        inline-flex items-center gap-1.5 rounded-full
                        border px-2.5 py-1 text-[11px] font-medium
                        transition
                        ${
                          deck.is_public
                            ? "border-emerald-300/15 bg-emerald-300/[0.055] text-emerald-100/55 hover:border-emerald-300/30 hover:text-emerald-100/80"
                            : "border-amber-300/15 bg-amber-300/[0.055] text-amber-100/55 hover:border-amber-300/30 hover:text-amber-100/80"
                        }
                        disabled:cursor-wait disabled:opacity-45
                      `}
                    >
                      <span
                        className={`
                          h-1.5 w-1.5 rounded-full
                          ${
                            deck.is_public
                              ? "bg-emerald-300/70"
                              : "bg-amber-300/70"
                          }
                        `}
                      />
                      {visibilitySaving
                        ? "Salvando..."
                        : deck.is_public
                          ? "Público"
                          : "Privado"}
                    </button>
                  ) : (
                    <span>{deck.is_public ? "Público" : "Privado"}</span>
                  )}

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

                  <div ref={priceMenuRef} className="relative z-[220]">
                    <button
                      type="button"
                      onClick={() => {
                        setPriceOpen((current) => !current);
                        setProblemsOpen(false);
                        void loadUsdBrlRate();
                      }}
                      className="
                        flex items-center gap-1.5
                        text-white/45
                        transition
                        hover:text-white/80
                      "
                    >
                      <span>
                        {deckPriceBrl !== null
                          ? `${new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(deckPriceBrl)}*`
                          : deckPrice.usd > 0
                            ? `US$ ${deckPrice.usd.toFixed(2)}`
                            : "Preço —"}
                      </span>

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
                          absolute left-0 top-full z-[300] mt-3
                          w-64 overflow-hidden
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
                            Referência TCGplayer
                          </p>

                          <p className="mt-1 text-sm font-medium text-white/75">
                            {deckPrice.usd > 0 ? `US$ ${deckPrice.usd.toFixed(2)}` : "US$ —"}
                          </p>
                          <p className="mt-1 text-[11px] text-white/25">
                            Soma das impressões com preço USD disponível.
                          </p>
                        </div>

                        <div className="rounded-lg border-t border-white/10 px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-white/25">
                            Conversão estimada
                          </p>

                          <p className="mt-1 text-sm font-medium text-white/75">
                            {fxLoading
                              ? "Carregando câmbio..."
                              : deckPriceBrl !== null
                                ? `${new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  }).format(deckPriceBrl)}*`
                                : "R$ —"}
                          </p>

                          {usdBrlRate && (
                            <p className="mt-1 text-[11px] text-white/25">
                              US$ 1 = R$ {usdBrlRate.toFixed(4)}
                            </p>
                          )}

                          {fxError && (
                            <p className="mt-2 rounded-md border border-amber-300/10 bg-amber-300/[0.04] px-2 py-1.5 text-[11px] leading-4 text-amber-100/55">
                              {fxError}
                            </p>
                          )}
                        </div>

                        <div className="rounded-lg border-t border-white/10 px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-white/25">
                            Cobertura
                          </p>
                          <p className="mt-1 text-sm font-medium text-white/70">
                            {deckPrice.pricedCopies} de {deckCardTotal} cartas com preço
                          </p>
                          {deckPrice.unpricedCopies > 0 && (
                            <details className="group mt-2 overflow-hidden rounded-lg border border-white/[0.07] bg-black/15">
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] text-white/40 transition hover:bg-white/[0.035] hover:text-white/65 [&::-webkit-details-marker]:hidden">
                                <span>
                                  Ver {deckPrice.unpricedCopies} carta(s) sem preço
                                </span>
                                <span className="text-[9px] transition-transform group-open:rotate-180">
                                  ▼
                                </span>
                              </summary>

                              <div className="max-h-48 overflow-y-auto border-t border-white/[0.06]">
                                {deckPrice.unpricedCards.map((card) => (
                                  <div
                                    key={card.key}
                                    className="flex items-start justify-between gap-3 border-b border-white/[0.05] px-3 py-2.5 last:border-b-0"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-[11px] font-medium text-white/60">
                                        {card.name}
                                      </p>
                                      <p className="mt-0.5 truncate text-[10px] text-white/25">
                                        {card.typeLine}
                                      </p>
                                    </div>

                                    <span className="shrink-0 rounded-md border border-white/[0.07] bg-white/[0.025] px-1.5 py-0.5 text-[10px] text-white/35">
                                      {card.quantity}x
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>

                        <div className="mx-2 mb-2 mt-1 rounded-lg border border-amber-300/10 bg-amber-300/[0.035] px-3 py-2.5">
                          <p className="text-[11px] leading-4 text-amber-100/45">
                            * Conversão apenas estimativa. O preço em reais não representa necessariamente o mercado brasileiro e pode variar por disponibilidade, frete, impostos, condição da carta e preços praticados no Brasil.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <span>•</span>

                  <div ref={problemsMenuRef} className="relative">
                    {deckStats.problems.length === 0 ? (
                      <span
                        title="Deck sem problemas detectados"
                        aria-label="Deck sem problemas detectados"
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] text-[13px] font-bold text-emerald-200/80"
                      >
                        ✓
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label={`${deckStats.problems.length} problema${deckStats.problems.length === 1 ? "" : "s"} detectado${deckStats.problems.length === 1 ? "" : "s"} no deck`}
                          title="Ver problemas do deck"
                          onClick={() => {
                            setProblemsOpen((current) => !current);
                            setPriceOpen(false);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/[0.09] text-[13px] font-bold text-amber-200/90 transition hover:border-amber-200/55 hover:bg-amber-300/[0.15] hover:text-amber-100"
                        >
                          !
                        </button>

                        {problemsOpen && (
                          <div className="absolute left-0 top-full z-50 mt-3 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-amber-300/20 bg-[#111114]/[0.99] shadow-2xl shadow-black/60 backdrop-blur-xl">
                            <div className="px-4 pb-3 pt-4">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/65">
                                Problemas do deck
                              </p>
                              <p className="mt-1.5 text-xs leading-5 text-white/40">
                                {deckStats.problems.length} item{deckStats.problems.length === 1 ? "" : "s"} para revisar
                              </p>
                            </div>

                            <div className="max-h-64 overflow-y-auto border-t border-white/10">
                              {deckStats.problems.map((problem, index) => (
                                <div
                                  key={`${problem}-${index}`}
                                  className="flex gap-3 border-b border-white/[0.06] px-4 py-3.5 last:border-b-0"
                                >
                                  <span className="mt-0.5 text-xs font-bold text-amber-200/70">!</span>
                                  <p className="text-xs leading-5 text-white/55">{problem}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
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

                {(deckTags.length > 0 || isOwner) && (
                  <div className="mt-4 flex max-w-4xl flex-wrap items-center gap-2">
                    {deckTags.map((tag) => (
                      <span
                        key={tag}
                        className="
                          inline-flex items-center gap-1.5
                          rounded-full border border-white/10
                          bg-black/20 px-2.5 py-1
                          text-[11px] text-white/45
                          backdrop-blur-sm
                        "
                      >
                        {tag}

                        {isOwner && (
                          <button
                            type="button"
                            aria-label={`Remover tag ${tag}`}
                            disabled={tagSaving}
                            onClick={() => removeDeckTag(tag)}
                            className="text-white/20 transition hover:text-white/70 disabled:opacity-30"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}

                    {isOwner && deckTags.length < 8 && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={tagInput}
                          maxLength={24}
                          disabled={tagSaving}
                          onChange={(event) => setTagInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addDeckTag();
                            }
                          }}
                          placeholder="Adicionar tag"
                          className="
                            h-7 w-28 rounded-full
                            border border-white/10
                            bg-black/20 px-2.5
                            text-[11px] text-white/55
                            outline-none
                            placeholder:text-white/20
                            focus:w-36 focus:border-white/25
                            transition-all
                            disabled:opacity-40
                          "
                        />

                        {tagInput.trim() && (
                          <button
                            type="button"
                            disabled={tagSaving}
                            onClick={addDeckTag}
                            className="
                              flex h-7 w-7 items-center justify-center
                              rounded-full border border-white/10
                              bg-black/20 text-sm text-white/35
                              transition hover:border-white/25 hover:text-white
                              disabled:opacity-30
                            "
                          >
                            +
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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
                      onClick={openUpdateDeckModal}
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
                      Criar nova versão
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
                    Adicionar em {activeBoardTitle}
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
                      placeholder="Nome, tipo, texto, categoria, cor..."
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

              <div className="border-b border-white/10 px-3">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {boardTabs.map((tab) => {
                    const count =
                      tab.id === "deck"
                        ? boardCounts.deck
                        : tab.id === "sideboard"
                          ? boardCounts.sideboard
                          : boardCounts.maybeboard;

                    const active = activeBoardTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveBoardTab(tab.id);
                          setCardSearchOpen(false);
                          setCardSearchError("");
                          setCardSearchStatus("");
                        }}
                        className={`
                          relative flex shrink-0 items-center gap-2
                          px-4 py-3 text-xs font-medium
                          transition
                          ${
                            active
                              ? "text-white/80"
                              : "text-white/30 hover:text-white/55"
                          }
                        `}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`
                            rounded-full px-1.5 py-0.5 text-[10px]
                            ${
                              active
                                ? "bg-white/[0.08] text-white/55"
                                : "bg-white/[0.035] text-white/25"
                            }
                          `}
                        >
                          {count}
                        </span>

                        {active && (
                          <span className="absolute bottom-0 left-3 right-3 h-px bg-white/60" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ÁREA DAS CARTAS */}
              <div className="min-h-[420px] px-5 py-4 md:px-6 lg:px-8">
                {activeBoardRows.length === 0 ? (
                  <div className="max-w-xl py-2">
                    <p className="text-lg text-white/55">
                      {activeBoardTab === "deck"
                        ? isOwner
                          ? "Seu deck está vazio."
                          : "Este deck está vazio."
                        : `${activeBoardTitle} vazio.`}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-white/30">
                      {isOwner
                        ? activeBoardTab === "deck"
                          ? "Adicione cartas para começar a montar o deck."
                          : `Use a busca acima para adicionar cartas ao ${activeBoardTitle}.`
                        : activeBoardTab === "deck"
                          ? "O autor ainda não adicionou cartas a este deck."
                          : `O autor ainda não adicionou cartas ao ${activeBoardTitle}.`}
                    </p>

                    {isOwner && activeBoardTab === "deck" && (
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
                          {activeBoardTitle}
                        </p>

                        <p className="mt-1 text-sm text-white/40">
                          {activeBoardCount} cartas
                        </p>
                      </div>
                    </div>

                    <div
                      className="w-full overflow-x-hidden pb-6 [zoom:0.69] xl:[zoom:0.75] 2xl:[zoom:0.95]"
                    >
                      <div
                        className={
                          organizeBy === "Categoria"
                            ? "w-full px-1 pt-1 [column-gap:0.5rem] [column-width:215px] lg:[column-width:225px] xl:[column-width:240px] 2xl:[column-width:255px]"
                            : "flex w-full flex-wrap items-start justify-start gap-x-2 gap-y-10 px-1 pt-1"
                        }
                      >
                        {deckCardsByType.map((group) => (
                          <section
                            key={group.name}
                            className={
                              organizeBy === "Categoria"
                                ? "mb-10 inline-block w-full break-inside-avoid align-top"
                                : "w-[215px] shrink-0 lg:w-[225px] xl:w-[240px] 2xl:w-[255px]"
                            }
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

                            <div
                              className={
                                organizeBy === "Categoria"
                                  ? "relative"
                                  : "relative min-h-[460px]"
                              }
                              style={
                                organizeBy === "Categoria"
                                  ? {
                                      minHeight: `${Math.max(
                                        332,
                                        332 + Math.max(0, group.cards.length - 1) * 112
                                      )}px`,
                                    }
                                  : undefined
                              }
                            >
                              {group.cards.map((row, index) => {
                                const image = getProxiedCardImage(row.card);

                                return (
                                  <div
                                    key={`${row.scryfall_id}-${row.board}`}
                                    onClick={() => {
                                      setPrintingPickerOpen(false);
                                      setPrintingOptions([]);
                                      setPrintingError("");
                                      openCardDetails(row);
                                    }}
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
                                            setPrintingPickerOpen(false);
                                            setPrintingOptions([]);
                                            setPrintingError("");
                                            openCardDetails(row);
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
        {!editing && deckCards.length > 0 && (
          <section className="pt-10 pb-12">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.015]">
              <button
                type="button"
                onClick={() => setStatsOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.025] md:px-6"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/25">Visão geral</p>
                  <p className="mt-1 text-sm font-medium text-white/65">Estatísticas do deck</p>
                </div>
                <span className="text-sm text-white/35">{statsOpen ? "−" : "+"}</span>
              </button>

              {statsOpen && (
                <div className="border-t border-white/10 px-5 py-5 md:px-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {[
                      ["Mana value médio", deckStats.averageManaValue.toFixed(2)],
                      ["Terrenos", String(deckStats.landCount)],
                      ["Criaturas", String(deckStats.creatureCount)],
                      ["Outras mágicas", String(deckStats.spellCount)],
                      ["Não terrenos", String(deckStats.nonLandCount)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.018] px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">{label}</p>
                        <p className="mt-1.5 text-lg font-semibold text-white/75">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr_1fr]">
                    <div className="rounded-xl border border-white/[0.07] px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs font-medium text-white/55">Curva de mana</p>
                        <p className="text-[10px] text-white/20">Terrenos não entram</p>
                      </div>
                      <div className="mt-5">
                        <div className="flex h-36 items-end justify-between gap-3 border-b border-white/10 px-2">
                          {deckStats.curve.map((count, index) => {
                            const max = Math.max(...deckStats.curve, 1);
                            const height = count === 0 ? 6 : Math.max(14, (count / max) * 118);

                            return (
                              <div
                                key={index}
                                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                              >
                                <span className="mb-2 text-[11px] font-medium text-white/40">
                                  {count}
                                </span>

                                <div
                                  className="w-[72%] min-w-5 max-w-11 rounded-t-lg border border-white/15 bg-white/20 shadow-[0_-8px_24px_rgba(255,255,255,0.035)] transition-all"
                                  style={{ height: `${height}px` }}
                                />
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-2 flex justify-between gap-3 px-2">
                          {deckStats.curve.map((_, index) => (
                            <div
                              key={index}
                              className="min-w-0 flex-1 text-center text-[10px] font-medium text-white/35"
                            >
                              {index === 7 ? "7+" : index}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/[0.07] px-4 py-4">
                      <p className="text-xs font-medium text-white/55">Distribuição de cores</p>
                      <div className="mt-4 space-y-2">
                        {[["W","Branco"],["U","Azul"],["B","Preto"],["R","Vermelho"],["G","Verde"],["C","Incolor"]].map(([key, label]) => (
                          <div key={key} className="flex items-center justify-between gap-4 text-xs">
                            <span className="text-white/35">{key} · {label}</span>
                            <span className="font-medium text-white/65">{deckStats.colorCounts[key]}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/[0.07] px-4 py-4">
                      <p className="text-xs font-medium text-white/55">Fontes de mana</p>
                      <div className="mt-4 space-y-2">
                        {[["W","Branco"],["U","Azul"],["B","Preto"],["R","Vermelho"],["G","Verde"],["C","Incolor / outras"]].map(([key, label]) => (
                          <div key={key} className="flex items-center justify-between gap-4 text-xs">
                            <span className="text-white/35">{key} · {label}</span>
                            <span className="font-medium text-white/65">{deckStats.manaSources[key]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
        setPrintingPickerOpen(false);
        setPrintingOptions([]);
        setPrintingError("");
        setSelectedCard(null);
      }
    }}
  >
    <button
      type="button"
      aria-label="Carta anterior"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={() => {
        if (printingPickerOpen) {
          void navigatePrintingCard(-1);
        } else {
          navigateSelectedCard(-1);
        }
      }}
      disabled={!hasPreviousSelectedCard || changingPrinting}
      className="
        absolute left-1 top-1/2 z-20
        flex h-10 w-10 -translate-y-1/2 items-center justify-center
        rounded-full
        border border-white/10
        bg-black/70
        text-3xl font-light text-white/70
        shadow-xl shadow-black/30
        backdrop-blur-md
        transition
        hover:border-white/25
        hover:bg-black/90
        hover:text-white
        disabled:cursor-default
        disabled:opacity-20
        disabled:hover:border-white/10
        disabled:hover:bg-black/70
        disabled:hover:text-white/70
        lg:left-3
      "
    >
      ‹
    </button>

    <button
      type="button"
      aria-label="Próxima carta"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={() => {
        if (printingPickerOpen) {
          void navigatePrintingCard(1);
        } else {
          navigateSelectedCard(1);
        }
      }}
      disabled={!hasNextSelectedCard || changingPrinting}
      className="
        absolute right-1 top-1/2 z-20
        flex h-10 w-10 -translate-y-1/2 items-center justify-center
        rounded-full
        border border-white/10
        bg-black/70
        text-3xl font-light text-white/70
        shadow-xl shadow-black/30
        backdrop-blur-md
        transition
        hover:border-white/25
        hover:bg-black/90
        hover:text-white
        disabled:cursor-default
        disabled:opacity-20
        disabled:hover:border-white/10
        disabled:hover:bg-black/70
        disabled:hover:text-white/70
        lg:right-3
      "
    >
      ›
    </button>

    <div
      className="
        relative
        w-full max-w-5xl
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
          onClick={() => {
            setPrintingPickerOpen(false);
            setPrintingOptions([]);
            setPrintingError("");
            setSelectedCard(null);
          }}
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
          lg:grid-cols-[0.92fr_380px_0.92fr]
        "
      >
        {/* LADO ESQUERDO */}
        <div className="space-y-7 pr-10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Impressão
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm font-medium text-white/75">
                {selectedCard.card?.set_name ?? "Edição não identificada"}
              </p>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/30">
                {selectedCard.card?.released_at && (
                  <span>
                    {formatCardReleaseDate(selectedCard.card.released_at)}
                  </span>
                )}

                {selectedCard.card?.rarity && (
                  <>
                    <span className="text-white/15">•</span>
                    <span>{formatCardRarity(selectedCard.card.rarity)}</span>
                  </>
                )}
              </div>

              {selectedCard.card?.printing_source === "oracle-fallback" && (
                <p className="mt-2 rounded-lg border border-amber-300/10 bg-amber-300/[0.035] px-2.5 py-2 text-[10px] leading-4 text-amber-100/45">
                  A impressão exata não está no espelho local. Estes dados são de outra impressão da mesma carta.
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Coleção
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm text-white/65">
                {selectedCard.card?.set
                  ? selectedCard.card.set.toUpperCase()
                  : "—"}
                {selectedCard.card?.collector_number
                  ? ` · #${selectedCard.card.collector_number}`
                  : ""}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Idioma
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm text-white/65">
                {formatCardLanguage(selectedCard.card?.lang)}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Identificador
            </p>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="break-all font-mono text-[11px] leading-5 text-white/30">
                {selectedCard.scryfall_id}
              </p>
            </div>
          </div>
        </div>

        {/* CARTA CENTRAL */}
        <div className="flex flex-col items-center">
          <div
            className="
              relative
              w-full max-w-[360px]
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

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPrintingPickerOpen(true);
                void loadCardPrintings(selectedCard);
              }}
              className="
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

            {isOwner && (
              <button
                type="button"
                disabled={selectedCard.board === "commander"}
                onClick={() => {
                  void setCardAsCommander(selectedCard);
                }}
                className={`
                  rounded-xl
                  border px-5 py-2.5
                  text-xs font-medium
                  transition
                  ${
                    selectedCard.board === "commander"
                      ? "cursor-default border-white/10 bg-white/[0.04] text-white/30"
                      : "border-white/10 text-white/50 hover:border-white/20 hover:bg-white/5 hover:text-white"
                  }
                `}
              >
                {selectedCard.board === "commander"
                  ? "Já é o comandante"
                  : "Definir como comandante"}
              </button>
            )}
          </div>
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
              {isOwner ? (
                <div>
                  <select
                    value={selectedCard.board}
                    disabled={movingCardBoard}
                    onChange={(event) => {
                      void moveCardToBoard(
                        selectedCard,
                        event.target.value as ImportBoard
                      );
                    }}
                    className="
                      w-full rounded-lg
                      border border-white/10
                      bg-[#111114]
                      px-3 py-2.5
                      text-sm text-white/65
                      outline-none transition
                      focus:border-white/25
                      disabled:cursor-wait disabled:opacity-45
                    "
                  >
                    <option value="mainboard">Deck principal</option>
                    <option value="sideboard">Sideboard</option>
                    <option value="maybeboard">Maybeboard</option>
                    <option value="commander">Comandante</option>
                  </select>

                  {movingCardBoard && (
                    <p className="mt-2 text-[10px] text-white/25">
                      Movendo carta...
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-white/65">
                  {getBoardLabel(selectedCard.board)}
                </p>
              )}
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
                {selectedCardUsd !== null ? `US$ ${selectedCardUsd.toFixed(2)}` : "US$ —"}
              </p>

              {fxLoading && usdBrlRate === null ? (
                <p className="mt-1 text-xs text-white/30">
                  Convertendo para real...
                </p>
              ) : selectedCardBrl !== null ? (
                <>
                  <p className="mt-1 text-xs font-medium text-white/45">
                    ≈ {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(selectedCardBrl)}*
                  </p>

                  <p className="mt-1 text-[10px] text-white/20">
                    US$ 1 = R$ {usdBrlRate?.toFixed(4)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-white/25">
                  Conversão em real indisponível.
                </p>
              )}

              <p
                title="Referência em dólar. A conversão para real é apenas uma estimativa e não representa necessariamente o preço praticado no Brasil."
                className="mt-2 inline-flex cursor-help items-center gap-1.5 text-[10px] text-white/25"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white/10 text-[9px]">
                  i
                </span>
                Conversão estimada
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

          <div className="min-h-0 flex-1 overflow-y-auto px-12 py-8">
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
                    Para compartilhar com outras pessoas, altere a visibilidade
                    para Público no topo da página.
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
            if (event.target === event.currentTarget && !creatingDeckVersion) {
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
            <div className="flex items-start justify-between gap-6 border-b border-white/10 px-6 py-5 md:px-8">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                  Nova versão
                </p>
                <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
                  Criar nova versão
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
                  Escolha as cartas que serão levadas para a nova versão. O deck
                  original continuará intacto.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setUpdateDeckOpen(false)}
                disabled={creatingDeckVersion}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/45 transition hover:border-white/25 hover:text-white disabled:opacity-40"
              >
                Fechar
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4 md:px-8">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setUpdateDeckSelection(
                      new Set(deckCards.map((row) => getDeckCardSelectionKey(row)))
                    )
                  }
                  disabled={deckCards.length === 0 || creatingDeckVersion}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/55 transition hover:border-white/25 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Selecionar tudo
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateDeckSelection(new Set())}
                  disabled={updateDeckSelection.size === 0 || creatingDeckVersion}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/55 transition hover:border-white/25 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Limpar seleção
                </button>
              </div>

              <p className="text-sm text-white/35">
                {selectedUpdateDeckCopies} de {updateDeckTotalCopies} cartas selecionadas
              </p>
            </div>

            <div className="overflow-y-auto px-6 py-6 md:px-8">
              {deckCards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-white/25">
                  Este deck ainda não possui cartas.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {updateDeckSections.map((section) => {
                    const sectionSelectedCount = section.cards.filter((row) =>
                      updateDeckSelection.has(getDeckCardSelectionKey(row))
                    ).length;
                    const wholeSectionSelected =
                      sectionSelectedCount === section.cards.length;
                    const sectionCopies = section.cards.reduce(
                      (total, row) => total + row.quantity,
                      0
                    );

                    return (
                      <section
                        key={section.name}
                        className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
                      >
                        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
                          <div>
                            <p className="font-medium text-white/75">
                              {section.name}
                            </p>
                            <p className="mt-0.5 text-xs text-white/30">
                              {sectionCopies} carta(s)
                            </p>
                          </div>

                          <label className="flex cursor-pointer items-center gap-2 text-xs text-white/45">
                            <input
                              type="checkbox"
                              checked={wholeSectionSelected}
                              onChange={(event) =>
                                setUpdateDeckSectionSelected(
                                  section.cards,
                                  event.target.checked
                                )
                              }
                              disabled={creatingDeckVersion}
                              className="h-4 w-4 accent-[#f4f1e8]"
                            />
                            Selecionar seção
                          </label>
                        </div>

                        <div className="max-h-[260px] divide-y divide-white/[0.06] overflow-y-auto">
                          {section.cards.map((row) => {
                            const key = getDeckCardSelectionKey(row);
                            const selected = updateDeckSelection.has(key);
                            const image = getProxiedCardImage(row.card);

                            return (
                              <label
                                key={key}
                                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.035] ${
                                  selected ? "bg-white/[0.02]" : "opacity-55"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleUpdateDeckCard(row)}
                                  disabled={creatingDeckVersion}
                                  className="h-4 w-4 shrink-0 accent-[#f4f1e8]"
                                />

                                <div className="h-12 w-9 shrink-0 overflow-hidden rounded border border-white/10 bg-[#17171a]">
                                  {image ? (
                                    <img
                                      src={image}
                                      alt={row.card?.name ?? "Carta"}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : null}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm text-white/75">
                                    {row.card?.name ?? `Carta ${row.scryfall_id.slice(0, 8)}…`}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-white/30">
                                    {row.card?.type_line ?? "Tipo indisponível"}
                                  </p>
                                </div>

                                <span className="shrink-0 text-xs font-medium text-white/40">
                                  ×{row.quantity}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 px-6 py-5 md:px-8">
              {updateDeckError && (
                <p className="mb-4 text-sm text-red-300/80">{updateDeckError}</p>
              )}

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <p className="max-w-2xl text-xs leading-5 text-white/25">
                  A nova versão será criada como um deck separado. Você poderá
                  editar nome, descrição e cartas normalmente depois.
                </p>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setUpdateDeckOpen(false)}
                    disabled={creatingDeckVersion}
                    className="rounded-lg px-4 py-2.5 text-sm text-white/45 transition hover:text-white disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void createDeckVersion()}
                    disabled={selectedUpdateDeckRows.length === 0 || creatingDeckVersion}
                    className="rounded-lg bg-[#f4f1e8] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {creatingDeckVersion ? "Criando..." : "Criar nova versão"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}