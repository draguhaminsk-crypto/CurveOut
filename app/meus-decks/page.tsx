"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import DeckCard, {
  type DeckCardData,
  type DeckCoverMode,
} from "./DeckCard";

type VisibilityFilter = "all" | "public" | "private";
type StatusFilter = "all" | "building" | "issues" | "ready";

type DeckCollection = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
};

type SortOption =
  | "updated_desc"
  | "created_desc"
  | "name_asc"
  | "name_desc"
  | "price_desc"
  | "last_opened_desc";

type RawDeck = {
  id: string;
  name: string;
  format: string;
  is_public: boolean;
  is_favorite?: boolean | null;
  description: string | null;
  tags?: string[] | null;
  commander_scryfall_id: string | null;
  collection_id?: string | null;
  last_opened_at?: string | null;
  created_at: string;
  updated_at: string;
};

type PrintingSnapshot = {
  scryfall_id?: string;
  oracle_id?: string | null;
  name?: string;
  image_uri?: string | null;
  image_uri_large?: string | null;
  art_crop?: string | null;
};

type RawDeckCard = {
  deck_id: string;
  scryfall_id: string;
  oracle_id: string | null;
  quantity: number;
  board: "mainboard" | "commander";
  printing_data?: PrintingSnapshot | null;
};

type RawCard = {
  scryfall_id: string;
  oracle_id: string | null;
  name: string;
  type_line: string | null;
  oracle_text: string | null;
  color_identity: unknown;
  card_data: unknown;
  image_uri: string | null;
  image_uri_large: string | null;
};

const colorOrder = ["W", "U", "B", "R", "G"];

function normalizeColors(colors: string[]) {
  return [...colors]
    .filter((color) => colorOrder.includes(color))
    .sort((a, b) => colorOrder.indexOf(a) - colorOrder.indexOf(b));
}

function getColorIdentityName(colors: string[]) {
  const key = normalizeColors(colors).join("");

  const names: Record<string, string> = {
    "": "Incolor",

    W: "Mono Branco",
    U: "Mono Azul",
    B: "Mono Preto",
    R: "Mono Vermelho",
    G: "Mono Verde",

    WU: "Azorius",
    UB: "Dimir",
    BR: "Rakdos",
    RG: "Gruul",
    WG: "Selesnya",
    WB: "Orzhov",
    UR: "Izzet",
    BG: "Golgari",
    WR: "Boros",
    UG: "Simic",

    WUG: "Bant",
    WUB: "Esper",
    UBR: "Grixis",
    BRG: "Jund",
    WRG: "Naya",

    WBG: "Abzan",
    WUR: "Jeskai",
    UBG: "Sultai",
    WBR: "Mardu",
    URG: "Temur",

    WUBR: "Yore-Tiller",
    WUBG: "Witch-Maw",
    WURG: "Ink-Treader",
    WBRG: "Dune-Brood",
    UBRG: "Glint-Eye",

    WUBRG: "Cinco cores",
  };

  return names[key] ?? "Multicolorido";
}

function getCardData(cardData: unknown) {
  if (!cardData || typeof cardData !== "object") {
    return {} as Record<string, unknown>;
  }

  return cardData as Record<string, unknown>;
}

function getCardFaces(cardData: unknown) {
  const data = getCardData(cardData);
  const faces = data.card_faces;

  if (!Array.isArray(faces)) return [];

  return faces.filter(
    (face): face is Record<string, unknown> =>
      Boolean(face) && typeof face === "object"
  );
}

function getImageUris(data: Record<string, unknown>) {
  const imageUris = data.image_uris;

  if (!imageUris || typeof imageUris !== "object") {
    return null;
  }

  return imageUris as Record<string, unknown>;
}

function getArtCrop(cardData: unknown) {
  const data = getCardData(cardData);
  const rootImages = getImageUris(data);
  const faceImages = getImageUris(getCardFaces(cardData)[0] ?? {});

  const candidates = [
    rootImages?.art_crop,
    faceImages?.art_crop,
  ];

  return (
    candidates.find((value): value is string => typeof value === "string") ??
    null
  );
}

function getCmc(cardData: unknown) {
  const data = getCardData(cardData);
  const cmc = data.cmc;

  return typeof cmc === "number" && Number.isFinite(cmc) ? cmc : 0;
}

function getUsdPrice(cardData: unknown) {
  const data = getCardData(cardData);
  const prices = data.prices;

  if (!prices || typeof prices !== "object") return null;

  const usd = (prices as Record<string, unknown>).usd;

  if (typeof usd === "number" && Number.isFinite(usd)) {
    return usd;
  }

  if (typeof usd === "string") {
    const parsed = Number(usd);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getCardColorIdentity(card: RawCard | null) {
  if (!card || !Array.isArray(card.color_identity)) return [];

  return card.color_identity.filter(
    (color): color is string => typeof color === "string"
  );
}

function isBasicLand(typeLine: string | null) {
  return (typeLine ?? "").toLocaleLowerCase("en-US").includes("basic land");
}

function isLand(typeLine: string | null) {
  return (typeLine ?? "").toLocaleLowerCase("en-US").includes("land");
}

function canHaveAnyNumber(oracleText: string | null) {
  const text = (oracleText ?? "").toLocaleLowerCase("en-US");

  return (
    text.includes("a deck can have any number of cards named") ||
    text.includes("a deck can have up to") ||
    text.includes("your deck can have any number of cards named")
  );
}

function proxyScryfallImage(url: string | null) {
  if (!url) return null;

  return `/api/scryfall/image?url=${encodeURIComponent(url)}`;
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

function buildDeckSummary(
  deck: RawDeck,
  rows: RawDeckCard[],
  cardsByScryfall: Map<string, RawCard>,
  cardsByOracle: Map<string, RawCard>
): DeckCardData {
  const commanderRow = rows.find((row) => row.board === "commander") ?? null;

  function resolveCard(row: RawDeckCard) {
    return (
      cardsByScryfall.get(row.scryfall_id) ??
      (row.oracle_id ? cardsByOracle.get(row.oracle_id) : undefined) ??
      null
    );
  }

  const commanderCard = commanderRow ? resolveCard(commanderRow) : null;
  const commanderSnapshot = commanderRow?.printing_data ?? null;

  const commanderName =
    commanderSnapshot?.name ??
    commanderCard?.name ??
    null;

  const exactArtCrop =
    commanderCard &&
    commanderCard.scryfall_id === commanderRow?.scryfall_id
      ? getArtCrop(commanderCard.card_data)
      : null;

  const snapshotArtCrop =
    typeof commanderSnapshot?.art_crop === "string"
      ? commanderSnapshot.art_crop
      : null;

  const snapshotFullImage =
    commanderSnapshot?.image_uri_large ??
    commanderSnapshot?.image_uri ??
    null;

  const fallbackArtCrop = getArtCrop(commanderCard?.card_data);
  const fallbackFullImage =
    commanderCard?.image_uri_large ??
    commanderCard?.image_uri ??
    null;

  let coverImage: string | null = null;
  let coverMode: DeckCoverMode = "art";

  if (exactArtCrop) {
    coverImage = exactArtCrop;
    coverMode = "art";
  } else if (snapshotArtCrop) {
    coverImage = snapshotArtCrop;
    coverMode = "art";
  } else if (snapshotFullImage) {
    coverImage = snapshotFullImage;
    coverMode = "full-card";
  } else if (fallbackArtCrop) {
    coverImage = fallbackArtCrop;
    coverMode = "art";
  } else if (fallbackFullImage) {
    coverImage = fallbackFullImage;
    coverMode = "full-card";
  }

  const primaryRows = rows.filter(
    (row) => row.board === "commander" || row.board === "mainboard"
  );

  const cardCount = primaryRows.reduce(
    (total, row) => total + Math.max(1, row.quantity),
    0
  );

  const nonLandMainRows = primaryRows.filter((row) => {
    if (row.board === "commander") return false;
    return !isLand(resolveCard(row)?.type_line ?? null);
  });

  let mvTotal = 0;
  let mvCopies = 0;

  for (const row of nonLandMainRows) {
    const card = resolveCard(row);
    const quantity = Math.max(1, row.quantity);

    mvTotal += getCmc(card?.card_data) * quantity;
    mvCopies += quantity;
  }

  const averageMv = mvCopies > 0 ? mvTotal / mvCopies : 0;

  let priceUsd = 0;
  let pricedCopies = 0;

  for (const row of primaryRows) {
    const card = resolveCard(row);
    const unitPrice = getUsdPrice(card?.card_data);

    if (unitPrice === null) continue;

    const quantity = Math.max(1, row.quantity);
    priceUsd += unitPrice * quantity;
    pricedCopies += quantity;
  }

  const commanderIdentity = getCardColorIdentity(commanderCard);
  const commanderIdentitySet = new Set(commanderIdentity);

  const problems: string[] = [];

  if (deck.format.toLocaleLowerCase("pt-BR") === "commander") {
    if (!commanderRow) {
      problems.push("Sem comandante");
    }

    if (cardCount !== 100) {
      problems.push("Quantidade diferente de 100");
    }

    const copiesByOracle = new Map<
      string,
      {
        quantity: number;
        card: RawCard | null;
      }
    >();

    for (const row of primaryRows) {
      const card = resolveCard(row);
      const key = row.oracle_id ?? row.scryfall_id;
      const current = copiesByOracle.get(key);

      copiesByOracle.set(key, {
        quantity: (current?.quantity ?? 0) + Math.max(1, row.quantity),
        card: current?.card ?? card,
      });
    }

    for (const value of copiesByOracle.values()) {
      if (value.quantity <= 1) continue;
      if (isBasicLand(value.card?.type_line ?? null)) continue;
      if (canHaveAnyNumber(value.card?.oracle_text ?? null)) continue;

      problems.push("Cópias acima do permitido");
      break;
    }

    if (commanderRow && commanderIdentity.length > 0) {
      const outsideIdentity = primaryRows.some((row) => {
        const card = resolveCard(row);
        const identity = getCardColorIdentity(card);

        return identity.some((color) => !commanderIdentitySet.has(color));
      });

      if (outsideIdentity) {
        problems.push("Carta fora da identidade de cor");
      }
    }
  }

  return {
    id: deck.id,
    name: deck.name,
    format: deck.format,
    is_public: deck.is_public,
    is_favorite: Boolean(deck.is_favorite),
    description: deck.description,
    tags: Array.isArray(deck.tags)
      ? deck.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    commander_scryfall_id: deck.commander_scryfall_id,
    commander_name: commanderName,
    commander_image: proxyScryfallImage(coverImage),
    commander_image_mode: coverMode,
    color_name: getColorIdentityName(commanderIdentity),
    card_count: cardCount,
    average_mv: averageMv,
    price_usd: pricedCopies > 0 ? priceUsd : null,
    is_legal:
      deck.format.toLocaleLowerCase("pt-BR") === "commander"
        ? problems.length === 0
        : null,
    problem_count: problems.length,
    problems,
    collection_id: deck.collection_id ?? null,
    collection_name: null,
    last_opened_at: deck.last_opened_at ?? null,
    created_at: deck.created_at,
    updated_at: deck.updated_at,
  };
}

function getDeckStatus(deck: DeckCardData): Exclude<StatusFilter, "all"> | "other" {
  if (deck.format.toLocaleLowerCase("pt-BR") !== "commander") {
    return "other";
  }

  if (deck.card_count < 100) {
    return "building";
  }

  if (deck.card_count === 100 && deck.problem_count === 0) {
    return "ready";
  }

  return "issues";
}

export default function MeusDecksPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [decks, setDecks] = useState<DeckCardData[]>([]);
  const [collections, setCollections] = useState<DeckCollection[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("Todos");
  const [colorFilter, setColorFilter] = useState("Todas");
  const [tagFilter, setTagFilter] = useState("Todas");
  const [sort, setSort] = useState<SortOption>("updated_desc");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkCollectionId, setBulkCollectionId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  const [renameDeck, setRenameDeck] = useState<DeckCardData | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [deleteDeck, setDeleteDeck] = useState<DeckCardData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDecks() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        if (!cancelled) {
          setErrorMessage("Não foi possível carregar sua conta.");
          setLoading(false);
        }
        return;
      }

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      setUserId(user.id);

      const { data: collectionRows, error: collectionsError } = await supabase
        .from("deck_collections")
        .select("id, owner_id, name, created_at")
        .eq("owner_id", user.id)
        .order("name", { ascending: true });

      if (collectionsError) {
        console.warn(
          "Pastas ainda não disponíveis. Rode a migration de organização de decks:",
          collectionsError.message
        );
        setCollections([]);
      } else {
        setCollections((collectionRows ?? []) as DeckCollection[]);
      }

      let rawDecks: RawDeck[] = [];

      const { data: decksWithFavorite, error: decksWithFavoriteError } =
        await supabase
          .from("decks")
          .select(
            "id, name, format, is_public, is_favorite, description, tags, commander_scryfall_id, collection_id, last_opened_at, created_at, updated_at"
          )
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false });

      if (!decksWithFavoriteError) {
        rawDecks = (decksWithFavorite ?? []) as RawDeck[];
      } else {
        // Fallback para quem ainda não rodou a migration de favoritos.
        const { data: decksFallback, error: decksFallbackError } =
          await supabase
            .from("decks")
            .select(
              "id, name, format, is_public, description, tags, commander_scryfall_id, created_at, updated_at"
            )
            .eq("owner_id", user.id)
            .order("updated_at", { ascending: false });

        if (decksFallbackError) {
          if (!cancelled) {
            console.error("Erro ao carregar decks:", decksFallbackError);
            setErrorMessage("Não foi possível carregar seus decks.");
            setLoading(false);
          }
          return;
        }

        rawDecks = ((decksFallback ?? []) as RawDeck[]).map((deck) => ({
          ...deck,
          is_favorite: false,
          collection_id: null,
          last_opened_at: null,
        }));
      }

      if (cancelled) return;

      if (rawDecks.length === 0) {
        setDecks([]);
        setLoading(false);
        return;
      }

      const deckIds = rawDecks.map((deck) => deck.id);

      const allDeckCards: RawDeckCard[] = [];
      const pageSize = 1000;

      for (let offset = 0; ; offset += pageSize) {
        let data: unknown[] | null = null;
        let error: { message?: string } | null = null;

        const resultWithPrinting = await supabase
          .from("deck_cards")
          .select(
            "deck_id, scryfall_id, oracle_id, quantity, board, printing_data"
          )
          .in("deck_id", deckIds)
          .in("board", ["commander", "mainboard"])
          .range(offset, offset + pageSize - 1);

        if (!resultWithPrinting.error) {
          data = resultWithPrinting.data;
        } else {
          const fallback = await supabase
            .from("deck_cards")
            .select("deck_id, scryfall_id, oracle_id, quantity, board")
            .in("deck_id", deckIds)
            .in("board", ["commander", "mainboard"])
            .range(offset, offset + pageSize - 1);

          data = fallback.data;
          error = fallback.error;
        }

        if (error) {
          console.error("Erro ao carregar cartas dos decks:", error);
          break;
        }

        const batch = (data ?? []) as RawDeckCard[];
        allDeckCards.push(...batch);

        if (batch.length < pageSize) break;
      }

      const uniqueScryfallIds = Array.from(
        new Set(allDeckCards.map((row) => row.scryfall_id).filter(Boolean))
      );

      const uniqueOracleIds = Array.from(
        new Set(
          allDeckCards
            .map((row) => row.oracle_id)
            .filter((value): value is string => typeof value === "string")
        )
      );

      const cardsByScryfall = new Map<string, RawCard>();
      const cardsByOracle = new Map<string, RawCard>();

      const cardSelect =
        "scryfall_id, oracle_id, name, type_line, oracle_text, color_identity, card_data, image_uri, image_uri_large";

      for (const idChunk of chunk(uniqueScryfallIds, 150)) {
        const { data, error } = await supabase
          .from("cards")
          .select(cardSelect)
          .in("scryfall_id", idChunk);

        if (error) {
          console.warn("Falha ao carregar algumas impressões exatas:", error);
          continue;
        }

        for (const raw of (data ?? []) as RawCard[]) {
          cardsByScryfall.set(raw.scryfall_id, raw);

          if (raw.oracle_id && !cardsByOracle.has(raw.oracle_id)) {
            cardsByOracle.set(raw.oracle_id, raw);
          }
        }
      }

      const missingOracleIds = uniqueOracleIds.filter(
        (oracleId) => !cardsByOracle.has(oracleId)
      );

      for (const idChunk of chunk(missingOracleIds, 150)) {
        const { data, error } = await supabase
          .from("cards")
          .select(cardSelect)
          .in("oracle_id", idChunk);

        if (error) {
          console.warn("Falha ao carregar fallback por oracle_id:", error);
          continue;
        }

        for (const raw of (data ?? []) as RawCard[]) {
          if (!cardsByOracle.has(raw.oracle_id ?? "")) {
            if (raw.oracle_id) {
              cardsByOracle.set(raw.oracle_id, raw);
            }
          }

          if (!cardsByScryfall.has(raw.scryfall_id)) {
            cardsByScryfall.set(raw.scryfall_id, raw);
          }
        }
      }

      const rowsByDeck = new Map<string, RawDeckCard[]>();

      for (const row of allDeckCards) {
        const current = rowsByDeck.get(row.deck_id) ?? [];
        current.push(row);
        rowsByDeck.set(row.deck_id, current);
      }

      const collectionNames = new Map(
        ((collectionRows ?? []) as DeckCollection[]).map((collection) => [
          collection.id,
          collection.name,
        ])
      );

      const summaries = rawDecks.map((deck) => {
        const summary = buildDeckSummary(
          deck,
          rowsByDeck.get(deck.id) ?? [],
          cardsByScryfall,
          cardsByOracle
        );

        return {
          ...summary,
          collection_name: summary.collection_id
            ? collectionNames.get(summary.collection_id) ?? null
            : null,
        };
      });

      if (!cancelled) {
        setDecks(summaries);
        setLoading(false);
      }
    }

    void loadDecks();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  const publicCount = useMemo(
    () => decks.filter((deck) => deck.is_public).length,
    [decks]
  );

  const privateCount = decks.length - publicCount;

  const formats = useMemo(
    () =>
      Array.from(new Set(decks.map((deck) => deck.format)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [decks]
  );

  const colors = useMemo(
    () =>
      Array.from(new Set(decks.map((deck) => deck.color_name)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [decks]
  );

  const tags = useMemo(
    () =>
      Array.from(new Set(decks.flatMap((deck) => deck.tags)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [decks]
  );

  const visibleDecks = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    const searchTokens = normalizedSearch.split(/\s+/).filter(Boolean);
    const tagQueries = searchTokens
      .filter((token) => token.startsWith("tag:"))
      .map((token) => token.slice(4).trim())
      .filter(Boolean);
    const textQuery = searchTokens
      .filter((token) => !token.startsWith("tag:"))
      .join(" ");

    const filtered = decks.filter((deck) => {
      if (visibilityFilter === "public" && !deck.is_public) return false;
      if (visibilityFilter === "private" && deck.is_public) return false;

      if (statusFilter !== "all" && getDeckStatus(deck) !== statusFilter) {
        return false;
      }

      if (
        collectionFilter === "none" &&
        deck.collection_id !== null
      ) {
        return false;
      }

      if (
        collectionFilter !== "all" &&
        collectionFilter !== "none" &&
        deck.collection_id !== collectionFilter
      ) {
        return false;
      }

      if (formatFilter !== "Todos" && deck.format !== formatFilter) {
        return false;
      }

      if (colorFilter !== "Todas" && deck.color_name !== colorFilter) {
        return false;
      }

      if (tagFilter !== "Todas" && !deck.tags.includes(tagFilter)) {
        return false;
      }

      if (
        tagQueries.length > 0 &&
        !tagQueries.every((tagQuery) =>
          deck.tags.some((tag) =>
            tag.toLocaleLowerCase("pt-BR").includes(tagQuery)
          )
        )
      ) {
        return false;
      }

      if (!textQuery) return true;

      const haystack = [
        deck.name,
        deck.format,
        deck.description ?? "",
        deck.commander_name ?? "",
        deck.color_name,
        deck.collection_name ?? "",
        ...deck.tags,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return haystack.includes(textQuery);
    });

    filtered.sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) {
        return a.is_favorite ? -1 : 1;
      }

      if (sort === "last_opened_desc") {
        const aTime = new Date(
          a.last_opened_at ?? a.updated_at
        ).getTime();
        const bTime = new Date(
          b.last_opened_at ?? b.updated_at
        ).getTime();

        return bTime - aTime;
      }

      if (sort === "created_desc") {
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      }

      if (sort === "name_asc") {
        return a.name.localeCompare(b.name, "pt-BR");
      }

      if (sort === "name_desc") {
        return b.name.localeCompare(a.name, "pt-BR");
      }

      if (sort === "price_desc") {
        return (b.price_usd ?? -1) - (a.price_usd ?? -1);
      }

      return (
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime()
      );
    });

    return filtered;
  }, [
    decks,
    visibilityFilter,
    statusFilter,
    collectionFilter,
    formatFilter,
    colorFilter,
    tagFilter,
    search,
    sort,
  ]);

  function patchDeck(id: string, patch: Partial<DeckCardData>) {
    setDecks((current) =>
      current.map((deck) => (deck.id === id ? { ...deck, ...patch } : deck))
    );
  }

  function toggleDeckSelection(deck: DeckCardData) {
    setSelectedDeckIds((current) => {
      const next = new Set(current);

      if (next.has(deck.id)) {
        next.delete(deck.id);
      } else {
        next.add(deck.id);
      }

      return next;
    });
  }

  function leaveSelectionMode() {
    setSelectionMode(false);
    setSelectedDeckIds(new Set());
    setBulkCollectionId("");
  }

  async function markDeckOpened(deck: DeckCardData) {
    const openedAt = new Date().toISOString();

    patchDeck(deck.id, { last_opened_at: openedAt });

    const { error } = await supabase
      .from("decks")
      .update({ last_opened_at: openedAt })
      .eq("id", deck.id);

    if (error) {
      console.warn(
        "Não foi possível registrar a última abertura do deck:",
        error.message
      );
    }
  }

  async function moveDeckToCollection(
    deck: DeckCardData,
    collectionId: string | null
  ) {
    const previousCollectionId = deck.collection_id;
    const previousCollectionName = deck.collection_name;
    const nextCollectionName = collectionId
      ? collections.find((collection) => collection.id === collectionId)?.name ??
        null
      : null;

    patchDeck(deck.id, {
      collection_id: collectionId,
      collection_name: nextCollectionName,
    });

    const { error } = await supabase
      .from("decks")
      .update({ collection_id: collectionId })
      .eq("id", deck.id);

    if (error) {
      patchDeck(deck.id, {
        collection_id: previousCollectionId,
        collection_name: previousCollectionName,
      });
      setErrorMessage(
        "Não foi possível mover o deck. Rode a migration de pastas no Supabase."
      );
    }
  }

  async function createCollection() {
    const cleanName = newCollectionName.trim();

    if (!cleanName || !userId || creatingCollection) return;

    setCreatingCollection(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("deck_collections")
      .insert({
        owner_id: userId,
        name: cleanName,
      })
      .select("id, owner_id, name, created_at")
      .single();

    if (error || !data) {
      setErrorMessage(
        error?.message ?? "Não foi possível criar a pasta."
      );
      setCreatingCollection(false);
      return;
    }

    setCollections((current) =>
      [...current, data as DeckCollection].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR")
      )
    );
    setCollectionFilter(data.id);
    setNewCollectionName("");
    setNewCollectionOpen(false);
    setCreatingCollection(false);
  }

  async function deleteCollection(collection: DeckCollection) {
    const decksInCollection = decks.filter(
      (deck) => deck.collection_id === collection.id
    ).length;

    const confirmed = window.confirm(
      decksInCollection > 0
        ? `Excluir a pasta “${collection.name}”? ${decksInCollection} deck${
            decksInCollection === 1 ? "" : "s"
          } voltar${decksInCollection === 1 ? "á" : "ão"} para “Sem pasta”.`
        : `Excluir a pasta “${collection.name}”?`
    );

    if (!confirmed) return;

    setErrorMessage("");

    const { error } = await supabase
      .from("deck_collections")
      .delete()
      .eq("id", collection.id);

    if (error) {
      setErrorMessage(
        error.message || "Não foi possível excluir a pasta."
      );
      return;
    }

    setCollections((current) =>
      current.filter((item) => item.id !== collection.id)
    );

    setDecks((current) =>
      current.map((deck) =>
        deck.collection_id === collection.id
          ? {
              ...deck,
              collection_id: null,
              collection_name: null,
            }
          : deck
      )
    );

    if (collectionFilter === collection.id) {
      setCollectionFilter("all");
    }

    if (bulkCollectionId === collection.id) {
      setBulkCollectionId("");
    }
  }

  async function applyBulkVisibility(isPublic: boolean) {
    const ids = Array.from(selectedDeckIds);
    if (ids.length === 0 || bulkSaving) return;

    setBulkSaving(true);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("decks")
      .update({
        is_public: isPublic,
        updated_at: now,
      })
      .in("id", ids);

    if (error) {
      setErrorMessage("Não foi possível alterar os decks selecionados.");
      setBulkSaving(false);
      return;
    }

    setDecks((current) =>
      current.map((deck) =>
        selectedDeckIds.has(deck.id)
          ? { ...deck, is_public: isPublic, updated_at: now }
          : deck
      )
    );

    setBulkSaving(false);
  }

  async function moveSelectedToCollection(collectionId: string | null) {
    const ids = Array.from(selectedDeckIds);
    if (ids.length === 0 || bulkSaving) return;

    setBulkSaving(true);

    const { error } = await supabase
      .from("decks")
      .update({ collection_id: collectionId })
      .in("id", ids);

    if (error) {
      setErrorMessage("Não foi possível mover os decks selecionados.");
      setBulkSaving(false);
      return;
    }

    const collectionName = collectionId
      ? collections.find((collection) => collection.id === collectionId)?.name ??
        null
      : null;

    setDecks((current) =>
      current.map((deck) =>
        selectedDeckIds.has(deck.id)
          ? {
              ...deck,
              collection_id: collectionId,
              collection_name: collectionName,
            }
          : deck
      )
    );

    setBulkCollectionId(collectionId ?? "");
    setBulkSaving(false);
  }

  async function deleteSelectedDecks() {
    const ids = Array.from(selectedDeckIds);
    if (ids.length === 0 || bulkSaving) return;

    const confirmed = window.confirm(
      `Excluir ${ids.length} deck${ids.length === 1 ? "" : "s"} selecionado${
        ids.length === 1 ? "" : "s"
      }? Essa ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    setBulkSaving(true);

    const { error } = await supabase
      .from("decks")
      .delete()
      .in("id", ids);

    if (error) {
      setErrorMessage("Não foi possível excluir os decks selecionados.");
      setBulkSaving(false);
      return;
    }

    setDecks((current) =>
      current.filter((deck) => !selectedDeckIds.has(deck.id))
    );

    leaveSelectionMode();
    setBulkSaving(false);
  }

  async function toggleFavorite(deck: DeckCardData) {
    const nextValue = !deck.is_favorite;

    patchDeck(deck.id, { is_favorite: nextValue });

    const { error } = await supabase
      .from("decks")
      .update({
        is_favorite: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deck.id);

    if (error) {
      patchDeck(deck.id, { is_favorite: deck.is_favorite });
      setErrorMessage(
        "Não foi possível favoritar o deck. Rode a migration de favoritos no Supabase."
      );
    }
  }

  async function toggleVisibility(deck: DeckCardData) {
    const nextValue = !deck.is_public;

    patchDeck(deck.id, { is_public: nextValue });

    const { error } = await supabase
      .from("decks")
      .update({
        is_public: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deck.id);

    if (error) {
      patchDeck(deck.id, { is_public: deck.is_public });
      setErrorMessage("Não foi possível alterar a visibilidade do deck.");
    }
  }

  function openRename(deck: DeckCardData) {
    setRenameDeck(deck);
    setRenameValue(deck.name);
  }

  async function confirmRename() {
    if (!renameDeck || renaming) return;

    const cleanName = renameValue.trim();

    if (!cleanName) return;

    setRenaming(true);
    setErrorMessage("");

    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("decks")
      .update({
        name: cleanName,
        updated_at: updatedAt,
      })
      .eq("id", renameDeck.id);

    if (error) {
      setErrorMessage("Não foi possível alterar o nome do deck.");
      setRenaming(false);
      return;
    }

    patchDeck(renameDeck.id, {
      name: cleanName,
      updated_at: updatedAt,
    });

    setRenameDeck(null);
    setRenameValue("");
    setRenaming(false);
  }

  async function confirmDelete() {
    if (!deleteDeck || deleting) return;

    setDeleting(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("decks")
      .delete()
      .eq("id", deleteDeck.id);

    if (error) {
      setErrorMessage("Não foi possível excluir o deck.");
      setDeleting(false);
      return;
    }

    setDecks((current) =>
      current.filter((deck) => deck.id !== deleteDeck.id)
    );

    setDeleteDeck(null);
    setDeleting(false);
  }

  function clearFilters() {
    setVisibilityFilter("all");
    setStatusFilter("all");
    setCollectionFilter("all");
    setSearch("");
    setFormatFilter("Todos");
    setColorFilter("Todas");
    setTagFilter("Todas");
  }

  const hasActiveFilters =
    visibilityFilter !== "all" ||
    statusFilter !== "all" ||
    collectionFilter !== "all" ||
    search.trim() !== "" ||
    formatFilter !== "Todos" ||
    colorFilter !== "Todas" ||
    tagFilter !== "Todas";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-[#f4f1e8]">
        <p className="text-sm text-white/35">Carregando seus decks...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-5 py-10 text-[#f4f1e8] md:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-[1500px]">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="
            mb-6 inline-flex items-center gap-2
            rounded-xl border border-white/10
            bg-[#0b0b0d]/90 px-3.5 py-2
            text-xs font-medium text-white/55
            transition
            hover:border-white/25 hover:bg-[#151518] hover:text-white
          "
        >
          ← Voltar
        </button>
        <div className="flex flex-col gap-7 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/25">
              Deckbuilding
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
              Meus decks
            </h1>

            <p className="mt-3 text-sm text-white/35">
              Encontre, organize e continue trabalhando nos seus decks.
            </p>
          </div>

          <Link
            href="/decks/novo"
            className="inline-flex w-fit items-center justify-center rounded-lg bg-[#f4f1e8] px-6 py-3 text-sm font-semibold text-black transition hover:bg-white"
          >
            Criar deck
          </Link>
        </div>

        <div className="mt-8 grid max-w-2xl grid-cols-3 gap-2.5 sm:gap-3">
          {(
            [
              ["all", "Todos", decks.length],
              ["public", "Públicos", publicCount],
              ["private", "Privados", privateCount],
            ] as const
          ).map(([id, label, count]) => {
            const active = visibilityFilter === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setVisibilityFilter(id)}
                className={`
                  rounded-xl border px-4 py-4 text-left transition
                  ${
                    active
                      ? "border-white/25 bg-white/[0.055]"
                      : "border-white/10 bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.03]"
                  }
                `}
              >
                <p className="text-2xl font-semibold">{count}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/25">
                  {label}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] uppercase tracking-[0.18em] text-white/20">
            Pastas
          </span>

          <button
            type="button"
            onClick={() => setCollectionFilter("all")}
            className={`
              rounded-lg border px-3 py-2 text-xs transition
              ${
                collectionFilter === "all"
                  ? "border-white/25 bg-white/[0.055] text-white/70"
                  : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/60"
              }
            `}
          >
            Todas
          </button>

          <button
            type="button"
            onClick={() => setCollectionFilter("none")}
            className={`
              rounded-lg border px-3 py-2 text-xs transition
              ${
                collectionFilter === "none"
                  ? "border-white/25 bg-white/[0.055] text-white/70"
                  : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/60"
              }
            `}
          >
            Sem pasta
          </button>

          {collections.map((collection) => {
            const active = collectionFilter === collection.id;

            return (
              <div
                key={collection.id}
                className={`
                  inline-flex overflow-hidden rounded-lg border transition
                  ${
                    active
                      ? "border-white/25 bg-white/[0.055]"
                      : "border-white/10 hover:border-white/20"
                  }
                `}
              >
                <button
                  type="button"
                  onClick={() => setCollectionFilter(collection.id)}
                  className={`
                    px-3 py-2 text-xs transition
                    ${
                      active
                        ? "text-white/70"
                        : "text-white/35 hover:bg-white/[0.025] hover:text-white/60"
                    }
                  `}
                >
                  {collection.name}
                </button>

                <button
                  type="button"
                  title={`Excluir pasta ${collection.name}`}
                  aria-label={`Excluir pasta ${collection.name}`}
                  onClick={() => {
                    void deleteCollection(collection);
                  }}
                  className="
                    border-l border-white/10
                    px-2.5 py-2
                    text-xs text-white/20
                    transition
                    hover:bg-red-300/[0.06]
                    hover:text-red-100/65
                  "
                >
                  ×
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setNewCollectionOpen(true)}
            className="rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-white/30 transition hover:border-white/30 hover:text-white/60"
          >
            + Nova pasta
          </button>
        </div>

        <div className="mt-9 border-t border-white/10 pt-7">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_145px_145px_145px_170px_205px]">
            <div>
              <label
                htmlFor="deck-list-search"
                className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25"
              >
                Procurar deck
              </label>

              <input
                id="deck-list-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, comandante, Esper, tag:controle..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.015] px-4 py-3 text-sm text-white/70 outline-none transition placeholder:text-white/20 focus:border-white/25"
              />
            </div>

            <div>
              <label
                htmlFor="deck-format-filter"
                className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25"
              >
                Formato
              </label>

              <select
                id="deck-format-filter"
                value={formatFilter}
                onChange={(event) => setFormatFilter(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none transition focus:border-white/25"
              >
                <option>Todos</option>
                {formats.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="deck-color-filter"
                className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25"
              >
                Cores
              </label>

              <select
                id="deck-color-filter"
                value={colorFilter}
                onChange={(event) => setColorFilter(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none transition focus:border-white/25"
              >
                <option>Todas</option>
                {colors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="deck-tag-filter"
                className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25"
              >
                Tag
              </label>

              <select
                id="deck-tag-filter"
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none transition focus:border-white/25"
              >
                <option>Todas</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="deck-status-filter"
                className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25"
              >
                Status
              </label>

              <select
                id="deck-status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none transition focus:border-white/25"
              >
                <option value="all">Todos</option>
                <option value="building">Em construção</option>
                <option value="issues">Com problemas</option>
                <option value="ready">Prontos</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="deck-list-sort"
                className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25"
              >
                Ordenar
              </label>

              <select
                id="deck-list-sort"
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as SortOption)
                }
                className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none transition focus:border-white/25"
              >
                <option value="updated_desc">
                  Atualizados recentemente
                </option>
                <option value="last_opened_desc">
                  Abertos recentemente
                </option>
                <option value="created_desc">
                  Criados recentemente
                </option>
                <option value="name_asc">Nome A–Z</option>
                <option value="name_desc">Nome Z–A</option>
                <option value="price_desc">Maior preço</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-white/30">
                {visibleDecks.length}{" "}
                {visibleDecks.length === 1
                  ? "deck encontrado"
                  : "decks encontrados"}
              </p>

              <button
                type="button"
                onClick={() => {
                  if (selectionMode) {
                    leaveSelectionMode();
                  } else {
                    setSelectionMode(true);
                  }
                }}
                className={`
                  rounded-lg border px-3 py-2 text-xs transition
                  ${
                    selectionMode
                      ? "border-white/25 bg-white/[0.05] text-white/70"
                      : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/60"
                  }
                `}
              >
                {selectionMode ? "Sair da seleção" : "Selecionar vários"}
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-white/30 underline underline-offset-4 transition hover:text-white/60"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {selectionMode && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <span className="mr-1 text-xs text-white/45">
                {selectedDeckIds.size} selecionado
                {selectedDeckIds.size === 1 ? "" : "s"}
              </span>

              <button
                type="button"
                onClick={() => {
                  const allVisibleSelected =
                    visibleDecks.length > 0 &&
                    visibleDecks.every((deck) =>
                      selectedDeckIds.has(deck.id)
                    );

                  if (allVisibleSelected) {
                    setSelectedDeckIds((current) => {
                      const next = new Set(current);
                      visibleDecks.forEach((deck) => next.delete(deck.id));
                      return next;
                    });
                  } else {
                    setSelectedDeckIds((current) => {
                      const next = new Set(current);
                      visibleDecks.forEach((deck) => next.add(deck.id));
                      return next;
                    });
                  }
                }}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/40 transition hover:border-white/20 hover:text-white/65"
              >
                Selecionar visíveis
              </button>

              <select
                value={bulkCollectionId}
                disabled={bulkSaving || selectedDeckIds.size === 0}
                onChange={(event) => {
                  const value = event.target.value;
                  setBulkCollectionId(value);
                  void moveSelectedToCollection(value || null);
                }}
                className="rounded-lg border border-white/10 bg-[#111114] px-3 py-2 text-xs text-white/50 outline-none disabled:opacity-35"
              >
                <option value="">Mover para: Sem pasta</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    Mover para: {collection.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={bulkSaving || selectedDeckIds.size === 0}
                onClick={() => {
                  void applyBulkVisibility(true);
                }}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/40 transition hover:border-white/20 hover:text-white/65 disabled:opacity-35"
              >
                Tornar públicos
              </button>

              <button
                type="button"
                disabled={bulkSaving || selectedDeckIds.size === 0}
                onClick={() => {
                  void applyBulkVisibility(false);
                }}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/40 transition hover:border-white/20 hover:text-white/65 disabled:opacity-35"
              >
                Tornar privados
              </button>

              <button
                type="button"
                disabled={bulkSaving || selectedDeckIds.size === 0}
                onClick={() => {
                  void deleteSelectedDecks();
                }}
                className="rounded-lg border border-red-300/15 px-3 py-2 text-xs text-red-100/45 transition hover:border-red-300/30 hover:text-red-100/70 disabled:opacity-35"
              >
                Excluir selecionados
              </button>
            </div>
          )}

          {errorMessage && (
            <p className="mt-4 rounded-xl border border-red-300/10 bg-red-300/[0.03] px-4 py-3 text-sm text-red-100/55">
              {errorMessage}
            </p>
          )}

          {visibleDecks.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleDecks.map((deck, index) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  index={index}
                  animationKey={`${visibilityFilter}|${statusFilter}|${collectionFilter}|${formatFilter}|${colorFilter}|${tagFilter}|${search}|${sort}`}
                  collections={collections}
                  selectionMode={selectionMode}
                  selected={selectedDeckIds.has(deck.id)}
                  onToggleSelected={toggleDeckSelection}
                  onOpen={(target) => {
                    void markDeckOpened(target);
                  }}
                  onMoveCollection={(target, collectionId) => {
                    void moveDeckToCollection(target, collectionId);
                  }}
                  onToggleFavorite={(target) => {
                    void toggleFavorite(target);
                  }}
                  onToggleVisibility={(target) => {
                    void toggleVisibility(target);
                  }}
                  onRename={openRename}
                  onDelete={setDeleteDeck}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-16 text-center">
              <p className="text-sm text-white/40">
                {decks.length === 0
                  ? "Você ainda não criou nenhum deck."
                  : "Nenhum deck corresponde aos filtros atuais."}
              </p>

              {decks.length === 0 ? (
                <Link
                  href="/decks/novo"
                  className="mt-5 inline-flex rounded-lg bg-[#f4f1e8] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white"
                >
                  Criar primeiro deck
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 text-sm text-white/45 underline underline-offset-4 transition hover:text-white"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {renameDeck && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !renaming) {
              setRenameDeck(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#101013] p-6 shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">
              Editar deck
            </p>
            <h2 className="mt-2 text-xl font-semibold">Alterar nome</h2>

            <input
              autoFocus
              type="text"
              value={renameValue}
              maxLength={500}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void confirmRename();
                }
              }}
              className="mt-5 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 outline-none transition focus:border-white/25"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={renaming}
                onClick={() => setRenameDeck(null)}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/45 transition hover:border-white/20 hover:text-white"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={renaming || !renameValue.trim()}
                onClick={() => {
                  void confirmRename();
                }}
                className="rounded-lg bg-[#f4f1e8] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-40"
              >
                {renaming ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {newCollectionOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !creatingCollection
            ) {
              setNewCollectionOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#101013] p-6 shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">
              Organização
            </p>
            <h2 className="mt-2 text-xl font-semibold">Nova pasta</h2>

            <p className="mt-2 text-sm leading-6 text-white/35">
              Use pastas para separar decks por projeto, estilo ou coleção.
            </p>

            <input
              autoFocus
              type="text"
              value={newCollectionName}
              maxLength={80}
              placeholder="Ex.: Competitivos"
              onChange={(event) => setNewCollectionName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void createCollection();
                }
              }}
              className="mt-5 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 outline-none transition placeholder:text-white/20 focus:border-white/25"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={creatingCollection}
                onClick={() => setNewCollectionOpen(false)}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/45 transition hover:border-white/20 hover:text-white"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={creatingCollection || !newCollectionName.trim()}
                onClick={() => {
                  void createCollection();
                }}
                className="rounded-lg bg-[#f4f1e8] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-40"
              >
                {creatingCollection ? "Criando..." : "Criar pasta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDeck && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteDeck(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#101013] p-6 shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.18em] text-red-100/35">
              Excluir deck
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Excluir “{deleteDeck.name}”?
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/35">
              As cartas vinculadas ao deck também serão removidas. Essa ação não
              pode ser desfeita.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteDeck(null)}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/45 transition hover:border-white/20 hover:text-white"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  void confirmDelete();
                }}
                className="rounded-lg border border-red-300/20 bg-red-300/[0.06] px-4 py-2.5 text-sm font-semibold text-red-100/70 transition hover:border-red-300/35 hover:bg-red-300/[0.1]"
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
