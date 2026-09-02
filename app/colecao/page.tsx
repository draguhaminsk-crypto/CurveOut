"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Finish = "normal" | "foil" | "etched";
type CardCondition = "NM" | "LP" | "MP" | "HP" | "DMG";
type CollectionKind = "collection" | "wishlist";
type ViewMode = "grid" | "compact" | "list";
type SortOption =
  | "name_asc"
  | "name_desc"
  | "recent_desc"
  | "quantity_desc"
  | "price_desc"
  | "price_asc"
  | "set_asc"
  | "rarity_desc";

type TypeFilter =
  | "Todos"
  | "Criatura"
  | "Artefato"
  | "Encantamento"
  | "Planeswalker"
  | "Instantânea"
  | "Feitiço"
  | "Terreno"
  | "Batalha"
  | "Outro";

type UserCollection = {
  id: string;
  owner_id: string;
  name: string;
  kind: CollectionKind;
  created_at: string;
  updated_at: string;
};

type CollectionRow = {
  id: string;
  owner_id: string;
  collection_id: string;
  scryfall_id: string;
  oracle_id: string | null;
  quantity: number;
  language: string;
  finish: Finish;
  card_condition: CardCondition;
  created_at: string;
  updated_at: string;
};

type CardCatalogRow = {
  scryfall_id: string;
  oracle_id: string | null;
  name: string;
  type_line: string | null;
  color_identity: unknown;
  image_uri: string | null;
  image_uri_large: string | null;
  card_data: unknown;
};

type CardMeta = {
  scryfall_id: string;
  oracle_id: string | null;
  name: string;
  type_line: string;
  colors: string[];
  image: string | null;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  lang: string;
  released_at: string;
  prices: {
    usd: number | null;
    usd_foil: number | null;
    usd_etched: number | null;
  };
};

type CollectionCard = CollectionRow & {
  card: CardMeta;
};

type BulkField =
  | "collection_id"
  | "card_condition"
  | "language"
  | "finish";

const typeOptions: TypeFilter[] = [
  "Todos",
  "Criatura",
  "Artefato",
  "Encantamento",
  "Planeswalker",
  "Instantânea",
  "Feitiço",
  "Terreno",
  "Batalha",
  "Outro",
];

const conditionLabels: Record<CardCondition, string> = {
  NM: "NM · Near Mint",
  LP: "LP · Lightly Played",
  MP: "MP · Moderately Played",
  HP: "HP · Heavily Played",
  DMG: "DMG · Damaged",
};

const rarityLabels: Record<string, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Rara",
  mythic: "Mítica",
  special: "Especial",
  bonus: "Bônus",
};

const finishLabels: Record<Finish, string> = {
  normal: "Normal",
  foil: "Foil",
  etched: "Etched",
};

const languageLabels: Record<string, string> = {
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
};

const manaMeta: Record<
  string,
  { label: string; className: string }
> = {
  W: {
    label: "Branco",
    className: "border-[#f1e5bd]/20 bg-[#f1e5bd]/10 text-[#f5ebcd]/75",
  },
  U: {
    label: "Azul",
    className: "border-sky-300/20 bg-sky-300/[0.07] text-sky-100/70",
  },
  B: {
    label: "Preto",
    className: "border-violet-300/15 bg-violet-300/[0.06] text-violet-100/65",
  },
  R: {
    label: "Vermelho",
    className: "border-red-300/20 bg-red-300/[0.07] text-red-100/70",
  },
  G: {
    label: "Verde",
    className: "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100/70",
  },
  C: {
    label: "Incolor",
    className: "border-white/12 bg-white/[0.045] text-white/55",
  },
};

const rarityOrder: Record<string, number> = {
  mythic: 6,
  rare: 5,
  uncommon: 4,
  common: 3,
  special: 2,
  bonus: 1,
  unknown: 0,
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(
  record: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  return typeof record[key] === "string"
    ? String(record[key])
    : fallback;
}

function readColors(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseUsd(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resolveCard(row: CardCatalogRow): CardMeta {
  const data = asRecord(row.card_data);
  const prices = asRecord(data.prices);

  return {
    scryfall_id: row.scryfall_id,
    oracle_id: row.oracle_id,
    name: row.name,
    type_line: row.type_line ?? "",
    colors: readColors(row.color_identity),
    image: row.image_uri_large ?? row.image_uri,
    set: readString(data, "set", "—").toUpperCase(),
    set_name: readString(data, "set_name", "Edição desconhecida"),
    collector_number: readString(data, "collector_number", "—"),
    rarity: readString(data, "rarity", "unknown"),
    lang: readString(data, "lang", "en"),
    released_at: readString(data, "released_at", ""),
    prices: {
      usd: parseUsd(prices.usd),
      usd_foil: parseUsd(prices.usd_foil),
      usd_etched: parseUsd(prices.usd_etched),
    },
  };
}

function proxyImage(url: string | null) {
  return url
    ? `/api/scryfall/image?url=${encodeURIComponent(url)}`
    : null;
}

function typeGroup(typeLine: string): TypeFilter {
  const value = typeLine.toLocaleLowerCase("pt-BR");

  if (value.includes("creature")) return "Criatura";
  if (value.includes("artifact")) return "Artefato";
  if (value.includes("enchantment")) return "Encantamento";
  if (value.includes("planeswalker")) return "Planeswalker";
  if (value.includes("instant")) return "Instantânea";
  if (value.includes("sorcery")) return "Feitiço";
  if (value.includes("land")) return "Terreno";
  if (value.includes("battle")) return "Batalha";

  return "Outro";
}

function chunks<T>(values: T[], size = 100) {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

function getUnitPrice(row: CollectionCard) {
  if (row.finish === "foil") return row.card.prices.usd_foil;
  if (row.finish === "etched") return row.card.prices.usd_etched;
  return row.card.prices.usd;
}

function formatUsd(value: number | null) {
  if (value === null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function languageName(value: string) {
  return languageLabels[value] ?? value.toUpperCase();
}

export default function CollectionPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [userId, setUserId] = useState<string | null>(null);
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [activeCollectionId, setActiveCollectionId] = useState<string>("all");

  const [search, setSearch] = useState("");
  const [colorFilter, setColorFilter] = useState("Todas");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Todos");
  const [setFilter, setSetFilter] = useState("Todos");
  const [rarityFilter, setRarityFilter] = useState("Todas");
  const [finishFilter, setFinishFilter] = useState("Todos");
  const [conditionFilter, setConditionFilter] = useState("Todos");

  const [sort, setSort] = useState<SortOption>("name_asc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkSaving, setBulkSaving] = useState(false);

  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [newCollectionKind, setNewCollectionKind] =
    useState<CollectionKind>("collection");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionSaving, setCollectionSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState<CardMeta[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addError, setAddError] = useState("");
  const [addTargetCollectionId, setAddTargetCollectionId] = useState("");
  const [addCondition, setAddCondition] =
    useState<CardCondition>("NM");
  const [addLanguage, setAddLanguage] = useState("auto");
  const [addFinish, setAddFinish] = useState<Finish>("normal");
  const [addingId, setAddingId] = useState<string | null>(null);

  const [selectedCard, setSelectedCard] =
    useState<CollectionCard | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCollection() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      if (cancelled) return;
      setUserId(user.id);

      // Coleções e cartas pertencem ao mesmo usuário e não dependem uma da outra.
      // Buscar as duas em paralelo economiza um round-trip inteiro ao Supabase.
      const [collectionsResult, cardsResult] = await Promise.all([
        supabase
          .from("user_collections")
          .select("id, owner_id, name, kind, created_at, updated_at")
          .eq("owner_id", user.id)
          .order("kind", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("user_collection_cards")
          .select(
            "id, owner_id, collection_id, scryfall_id, oracle_id, quantity, language, finish, card_condition, created_at, updated_at"
          )
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);

      const {
        data: initialCollectionRows,
        error: collectionsError,
      } = collectionsResult;

      const { data: cardRows, error: cardsError } = cardsResult;

      let collectionRows = initialCollectionRows;

      if (collectionsError) {
        console.error("Erro ao carregar coleções:", collectionsError);
        setErrorMessage(
          "Não foi possível carregar suas coleções. Rode o SQL da Coleção V2 no Supabase."
        );
        setLoading(false);
        return;
      }

      if (!collectionRows || collectionRows.length === 0) {
        const { data: defaultCollection, error: defaultError } = await supabase
          .from("user_collections")
          .insert({
            owner_id: user.id,
            name: "Minha coleção",
            kind: "collection",
          })
          .select("id, owner_id, name, kind, created_at, updated_at")
          .single();

        if (defaultError || !defaultCollection) {
          setErrorMessage(
            defaultError?.message ?? "Não foi possível criar sua coleção inicial."
          );
          setLoading(false);
          return;
        }

        collectionRows = [defaultCollection];
      }

      const loadedCollections = collectionRows as UserCollection[];
      setCollections(loadedCollections);

      if (cardsError) {
        console.error("Erro ao carregar cartas da coleção:", cardsError);
        setErrorMessage(
          "Não foi possível carregar suas cartas. Confirme se a migration da Coleção V2 foi executada."
        );
        setLoading(false);
        return;
      }

      const rows = (cardRows ?? []) as CollectionRow[];

      if (rows.length === 0) {
        setCards([]);
        setLoading(false);
        return;
      }

      const ids = Array.from(new Set(rows.map((row) => row.scryfall_id)));

      // Coleções grandes precisam consultar a tabela `cards` em blocos.
      // Antes os blocos eram aguardados um por um; agora rodam em paralelo.
      const catalogParts = await Promise.all(
        chunks(ids).map(async (part) => {
          const { data, error } = await supabase
            .from("cards")
            .select(
              "scryfall_id, oracle_id, name, type_line, color_identity, image_uri, image_uri_large, card_data"
            )
            .in("scryfall_id", part);

          if (error) {
            console.error("Erro ao resolver cartas da coleção:", error);
            return [] as CardCatalogRow[];
          }

          return (data ?? []) as CardCatalogRow[];
        })
      );

      const catalog = catalogParts.flat();

      if (cancelled) return;

      const byId = new Map(
        catalog.map((row) => [row.scryfall_id, resolveCard(row)])
      );

      setCards(
        rows.map((row) => ({
          ...row,
          card:
            byId.get(row.scryfall_id) ??
            ({
              scryfall_id: row.scryfall_id,
              oracle_id: row.oracle_id,
              name: "Carta não encontrada",
              type_line: "",
              colors: [],
              image: null,
              set: "—",
              set_name: "Impressão não encontrada",
              collector_number: "—",
              rarity: "unknown",
              lang: row.language,
              released_at: "",
              prices: {
                usd: null,
                usd_foil: null,
                usd_etched: null,
              },
            } satisfies CardMeta),
        }))
      );

      setLoading(false);
    }

    void loadCollection();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!addOpen) return;

    const query = addSearch.trim();

    if (query.length < 2) {
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setAddSearching(true);
      setAddError("");

      const { data, error } = await supabase
        .from("cards")
        .select(
          "scryfall_id, oracle_id, name, type_line, color_identity, image_uri, image_uri_large, card_data"
        )
        .ilike("name", `%${query}%`)
        .limit(30);

      if (cancelled) return;

      if (error) {
        setAddResults([]);
        setAddError("Não foi possível procurar essa carta.");
        setAddSearching(false);
        return;
      }

      const normalized = query.toLocaleLowerCase("pt-BR");

      const results = ((data ?? []) as CardCatalogRow[])
        .map(resolveCard)
        .sort((a, b) => {
          const aStarts = a.name
            .toLocaleLowerCase("pt-BR")
            .startsWith(normalized);
          const bStarts = b.name
            .toLocaleLowerCase("pt-BR")
            .startsWith(normalized);

          if (aStarts !== bStarts) return aStarts ? -1 : 1;
          if (a.name !== b.name) {
            return a.name.localeCompare(b.name, "pt-BR");
          }

          return b.released_at.localeCompare(a.released_at);
        });

      setAddResults(results);
      setAddSearching(false);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addOpen, addSearch, supabase]);

  const physicalCollections = useMemo(
    () => collections.filter((collection) => collection.kind === "collection"),
    [collections]
  );

  const wishlists = useMemo(
    () => collections.filter((collection) => collection.kind === "wishlist"),
    [collections]
  );

  const activeCollection = useMemo(
    () => collections.find((collection) => collection.id === activeCollectionId) ?? null,
    [activeCollectionId, collections]
  );

  const scopedCards = useMemo(() => {
    if (activeCollectionId === "all") {
      const physicalIds = new Set(
        physicalCollections.map((collection) => collection.id)
      );

      return cards.filter((row) => physicalIds.has(row.collection_id));
    }

    return cards.filter((row) => row.collection_id === activeCollectionId);
  }, [activeCollectionId, cards, physicalCollections]);

  const stats = useMemo(() => {
    const unique = new Set(
      scopedCards.map((row) => row.oracle_id ?? row.scryfall_id)
    ).size;

    const copies = scopedCards.reduce(
      (total, row) => total + Math.max(0, row.quantity),
      0
    );

    const sets = new Set(
      scopedCards
        .map((row) => row.card.set)
        .filter((set) => set !== "—")
    ).size;

    let value = 0;
    let pricedCopies = 0;

    for (const row of scopedCards) {
      const unitPrice = getUnitPrice(row);

      if (unitPrice === null) continue;

      value += unitPrice * row.quantity;
      pricedCopies += row.quantity;
    }

    return {
      unique,
      copies,
      sets,
      value,
      pricedCopies,
    };
  }, [scopedCards]);

  const colorStats = useMemo(() => {
    const totals: Record<string, number> = {
      W: 0,
      U: 0,
      B: 0,
      R: 0,
      G: 0,
      C: 0,
    };

    for (const row of scopedCards) {
      const quantity = Math.max(0, row.quantity);
      const colors = row.card.colors;

      if (colors.length === 0) {
        totals.C += quantity;
        continue;
      }

      for (const color of colors) {
        if (color in totals) totals[color] += quantity;
      }
    }

    const totalMentions = Object.values(totals).reduce(
      (sum, value) => sum + value,
      0
    );

    return Object.entries(totals)
      .map(([color, count]) => ({
        color,
        count,
        percentage:
          totalMentions > 0 ? (count / totalMentions) * 100 : 0,
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [scopedCards]);

  const rarityStats = useMemo(() => {
    const totals = new Map<string, number>();

    for (const row of scopedCards) {
      const rarity = row.card.rarity || "unknown";
      totals.set(rarity, (totals.get(rarity) ?? 0) + row.quantity);
    }

    const max = Math.max(1, ...Array.from(totals.values()));

    return Array.from(totals.entries())
      .sort(
        (a, b) =>
          (rarityOrder[b[0]] ?? 0) - (rarityOrder[a[0]] ?? 0)
      )
      .map(([rarity, count]) => ({
        rarity,
        count,
        percentage: (count / max) * 100,
      }));
  }, [scopedCards]);

  const sets = useMemo(
    () =>
      Array.from(
        new Set(
          scopedCards
            .map((row) => row.card.set)
            .filter((set) => set !== "—")
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [scopedCards]
  );

  const rarities = useMemo(
    () =>
      Array.from(
        new Set(
          scopedCards
            .map((row) => row.card.rarity)
            .filter((rarity) => rarity !== "unknown")
        )
      ).sort(),
    [scopedCards]
  );

  const visibleCards = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");

    const filtered = scopedCards.filter((row) => {
      if (query) {
        const collectionName =
          collections.find((collection) => collection.id === row.collection_id)
            ?.name ?? "";

        const text = [
          row.card.name,
          row.card.type_line,
          row.card.set,
          row.card.set_name,
          row.card.collector_number,
          collectionName,
          row.language,
          row.card_condition,
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR");

        if (!text.includes(query)) return false;
      }

      if (colorFilter !== "Todas") {
        if (colorFilter === "C" && row.card.colors.length > 0) return false;
        if (
          colorFilter !== "C" &&
          !row.card.colors.includes(colorFilter)
        ) {
          return false;
        }
      }

      if (
        typeFilter !== "Todos" &&
        typeGroup(row.card.type_line) !== typeFilter
      ) {
        return false;
      }

      if (setFilter !== "Todos" && row.card.set !== setFilter) return false;

      if (
        rarityFilter !== "Todas" &&
        row.card.rarity !== rarityFilter
      ) {
        return false;
      }

      if (finishFilter !== "Todos" && row.finish !== finishFilter) {
        return false;
      }

      if (
        conditionFilter !== "Todos" &&
        row.card_condition !== conditionFilter
      ) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (sort === "name_desc") {
        return b.card.name.localeCompare(a.card.name, "pt-BR");
      }

      if (sort === "recent_desc") {
        return (
          new Date(b.updated_at).getTime() -
          new Date(a.updated_at).getTime()
        );
      }

      if (sort === "quantity_desc") {
        return b.quantity - a.quantity;
      }

      if (sort === "price_desc") {
        return (getUnitPrice(b) ?? -1) - (getUnitPrice(a) ?? -1);
      }

      if (sort === "price_asc") {
        const aPrice = getUnitPrice(a);
        const bPrice = getUnitPrice(b);

        if (aPrice === null && bPrice === null) return 0;
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;

        return aPrice - bPrice;
      }

      if (sort === "set_asc") {
        const bySet = a.card.set.localeCompare(b.card.set, "pt-BR");
        return bySet !== 0
          ? bySet
          : a.card.name.localeCompare(b.card.name, "pt-BR");
      }

      if (sort === "rarity_desc") {
        const difference =
          (rarityOrder[b.card.rarity] ?? 0) -
          (rarityOrder[a.card.rarity] ?? 0);

        return difference !== 0
          ? difference
          : a.card.name.localeCompare(b.card.name, "pt-BR");
      }

      return a.card.name.localeCompare(b.card.name, "pt-BR");
    });

    return filtered;
  }, [
    scopedCards,
    search,
    colorFilter,
    typeFilter,
    setFilter,
    rarityFilter,
    finishFilter,
    conditionFilter,
    sort,
    collections,
  ]);

  const hasFilters =
    Boolean(search.trim()) ||
    colorFilter !== "Todas" ||
    typeFilter !== "Todos" ||
    setFilter !== "Todos" ||
    rarityFilter !== "Todas" ||
    finishFilter !== "Todos" ||
    conditionFilter !== "Todos";

  function handleAddSearchChange(value: string) {
    setAddSearch(value);

    if (value.trim().length < 2) {
      setAddResults([]);
      setAddSearching(false);
      setAddError("");
    }
  }

  function clearFilters() {
    setSearch("");
    setColorFilter("Todas");
    setTypeFilter("Todos");
    setSetFilter("Todos");
    setRarityFilter("Todas");
    setFinishFilter("Todos");
    setConditionFilter("Todos");
  }

  function defaultTargetCollection() {
    if (activeCollection) return activeCollection.id;
    return physicalCollections[0]?.id ?? collections[0]?.id ?? "";
  }

  function openAddModal() {
    setAddTargetCollectionId(defaultTargetCollection());
    setAddSearch("");
    setAddResults([]);
    setAddError("");
    setAddCondition("NM");
    setAddLanguage("auto");
    setAddFinish("normal");
    setAddOpen(true);
  }

  function toggleSelection(row: CollectionCard) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }

      return next;
    });
  }

  function leaveSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function createCollection() {
    const name = newCollectionName.trim();

    if (!userId || !name || collectionSaving) return;

    setCollectionSaving(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("user_collections")
      .insert({
        owner_id: userId,
        name,
        kind: newCollectionKind,
      })
      .select("id, owner_id, name, kind, created_at, updated_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Não foi possível criar a coleção.");
      setCollectionSaving(false);
      return;
    }

    const created = data as UserCollection;

    setCollections((current) => [...current, created]);
    setActiveCollectionId(created.id);
    setNewCollectionName("");
    setCollectionModalOpen(false);
    setCollectionSaving(false);
  }

  async function renameCollection(collection: UserCollection) {
    const nextName = window.prompt("Novo nome:", collection.name)?.trim();

    if (!nextName || nextName === collection.name) return;

    const { error } = await supabase
      .from("user_collections")
      .update({
        name: nextName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", collection.id)
      .eq("owner_id", collection.owner_id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setCollections((current) =>
      current.map((item) =>
        item.id === collection.id ? { ...item, name: nextName } : item
      )
    );
  }

  async function deleteCollection(collection: UserCollection) {
    const count = cards.filter(
      (row) => row.collection_id === collection.id
    ).length;

    const confirmed = window.confirm(
      count > 0
        ? `Excluir “${collection.name}” e suas ${count} entrada${
            count === 1 ? "" : "s"
          }? Essa ação não pode ser desfeita.`
        : `Excluir “${collection.name}”?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("user_collections")
      .delete()
      .eq("id", collection.id)
      .eq("owner_id", collection.owner_id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setCollections((current) =>
      current.filter((item) => item.id !== collection.id)
    );
    setCards((current) =>
      current.filter((row) => row.collection_id !== collection.id)
    );
    setActiveCollectionId("all");
    setSelectedIds(new Set());
  }

  async function addCard(card: CardMeta) {
    if (!userId || addingId || !addTargetCollectionId) return;

    const targetCollection = collections.find(
      (collection) => collection.id === addTargetCollectionId
    );

    if (!targetCollection) {
      setAddError("Escolha uma coleção ou lista de desejos.");
      return;
    }

    setAddingId(card.scryfall_id);
    setAddError("");

    const language =
      addLanguage === "auto" ? card.lang || "en" : addLanguage;

    const existing = cards.find(
      (row) =>
        row.collection_id === addTargetCollectionId &&
        row.scryfall_id === card.scryfall_id &&
        row.language === language &&
        row.finish === addFinish &&
        row.card_condition === addCondition
    );

    if (existing) {
      const quantity = existing.quantity + 1;
      const updatedAt = new Date().toISOString();

      const { error } = await supabase
        .from("user_collection_cards")
        .update({ quantity, updated_at: updatedAt })
        .eq("id", existing.id)
        .eq("owner_id", userId);

      if (error) {
        setAddError("Não foi possível aumentar a quantidade.");
        setAddingId(null);
        return;
      }

      setCards((current) =>
        current.map((row) =>
          row.id === existing.id
            ? { ...row, quantity, updated_at: updatedAt }
            : row
        )
      );

      setAddingId(null);
      return;
    }

    const { data, error } = await supabase
      .from("user_collection_cards")
      .insert({
        owner_id: userId,
        collection_id: addTargetCollectionId,
        scryfall_id: card.scryfall_id,
        oracle_id: card.oracle_id,
        quantity: 1,
        language,
        finish: addFinish,
        card_condition: addCondition,
      })
      .select(
        "id, owner_id, collection_id, scryfall_id, oracle_id, quantity, language, finish, card_condition, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      setAddError(error?.message ?? "Não foi possível adicionar a carta.");
      setAddingId(null);
      return;
    }

    setCards((current) => [
      { ...(data as CollectionRow), card },
      ...current,
    ]);

    setAddingId(null);
  }

  async function changeQuantity(row: CollectionCard, quantity: number) {
    if (!userId || savingId) return;

    if (quantity <= 0) {
      await removeCard(row);
      return;
    }

    setSavingId(row.id);
    setErrorMessage("");

    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("user_collection_cards")
      .update({ quantity, updated_at: updatedAt })
      .eq("id", row.id)
      .eq("owner_id", userId);

    if (error) {
      setErrorMessage("Não foi possível atualizar a quantidade.");
      setSavingId(null);
      return;
    }

    const patch = { quantity, updated_at: updatedAt };

    setCards((current) =>
      current.map((item) =>
        item.id === row.id ? { ...item, ...patch } : item
      )
    );

    setSelectedCard((current) =>
      current?.id === row.id ? { ...current, ...patch } : current
    );

    setSavingId(null);
  }

  async function updateCardMeta(
    row: CollectionCard,
    patch: Partial<
      Pick<
        CollectionRow,
        "collection_id" | "card_condition" | "language" | "finish"
      >
    >
  ) {
    if (!userId || savingId) return;

    setSavingId(row.id);
    setErrorMessage("");

    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("user_collection_cards")
      .update({ ...patch, updated_at: updatedAt })
      .eq("id", row.id)
      .eq("owner_id", userId);

    if (error) {
      setErrorMessage(
        error.code === "23505"
          ? "Já existe uma entrada igual nessa coleção. Ajuste a quantidade da entrada existente."
          : error.message
      );
      setSavingId(null);
      return;
    }

    setCards((current) =>
      current.map((item) =>
        item.id === row.id
          ? { ...item, ...patch, updated_at: updatedAt }
          : item
      )
    );

    setSelectedCard((current) =>
      current?.id === row.id
        ? { ...current, ...patch, updated_at: updatedAt }
        : current
    );

    setSavingId(null);
  }

  async function removeCard(row: CollectionCard) {
    if (!userId || savingId) return;

    if (!window.confirm(`Remover “${row.card.name}” desta lista?`)) return;

    setSavingId(row.id);
    setErrorMessage("");

    const { error } = await supabase
      .from("user_collection_cards")
      .delete()
      .eq("id", row.id)
      .eq("owner_id", userId);

    if (error) {
      setErrorMessage("Não foi possível remover a carta.");
      setSavingId(null);
      return;
    }

    setCards((current) =>
      current.filter((item) => item.id !== row.id)
    );

    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(row.id);
      return next;
    });

    if (selectedCard?.id === row.id) setSelectedCard(null);
    setSavingId(null);
  }

  async function bulkUpdate(field: BulkField, value: string) {
    const ids = Array.from(selectedIds);

    if (!userId || ids.length === 0 || bulkSaving) return;

    setBulkSaving(true);
    setErrorMessage("");

    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("user_collection_cards")
      .update({
        [field]: value,
        updated_at: updatedAt,
      })
      .eq("owner_id", userId)
      .in("id", ids);

    if (error) {
      setErrorMessage(
        error.code === "23505"
          ? "A alteração criaria entradas duplicadas. Faça essa mudança individualmente."
          : error.message
      );
      setBulkSaving(false);
      return;
    }

    setCards((current) =>
      current.map((row) =>
        selectedIds.has(row.id)
          ? {
              ...row,
              [field]: value,
              updated_at: updatedAt,
            }
          : row
      ) as CollectionCard[]
    );

    setBulkSaving(false);
  }

  async function deleteSelected() {
    const ids = Array.from(selectedIds);

    if (!userId || ids.length === 0 || bulkSaving) return;

    if (
      !window.confirm(
        `Remover ${ids.length} entrada${ids.length === 1 ? "" : "s"} selecionada${
          ids.length === 1 ? "" : "s"
        }?`
      )
    ) {
      return;
    }

    setBulkSaving(true);

    const { error } = await supabase
      .from("user_collection_cards")
      .delete()
      .eq("owner_id", userId)
      .in("id", ids);

    if (error) {
      setErrorMessage(error.message);
      setBulkSaving(false);
      return;
    }

    setCards((current) =>
      current.filter((row) => !selectedIds.has(row.id))
    );

    leaveSelectionMode();
    setBulkSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-white/35">
        Carregando coleção...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-5 py-10 text-[#f4f1e8] md:px-10">
      <div className="mx-auto w-full max-w-[1500px]">
        <Link
          href="/"
          className="text-sm text-white/35 transition hover:text-white"
        >
          ← CurveOut
        </Link>

        <div className="mt-10 flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#c8b27a]/55">
              Biblioteca pessoal
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
              Minha coleção
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/35">
              Organize suas cartas em coleções separadas, acompanhe sua lista
              de desejos e mantenha impressão, estado e idioma registrados.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setNewCollectionKind("collection");
                setNewCollectionName("");
                setCollectionModalOpen(true);
              }}
              className="rounded-xl border border-white/12 px-4 py-3 text-sm text-white/50 transition hover:border-white/25 hover:text-white/75"
            >
              + Nova coleção
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="rounded-xl bg-[#f4f1e8] px-5 py-3 text-sm font-semibold text-black transition hover:bg-white"
            >
              + Adicionar carta
            </button>
          </div>
        </div>

        {errorMessage && (
          <p className="mt-6 rounded-xl border border-red-300/10 bg-red-300/[0.03] px-4 py-3 text-sm text-red-100/60">
            {errorMessage}
          </p>
        )}

        <section className="mt-9 rounded-2xl border border-white/[0.07] bg-white/[0.012] p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[10px] uppercase tracking-[0.18em] text-white/20">
              Coleções
            </span>

            <CollectionTab
              active={activeCollectionId === "all"}
              label="Todas"
              onClick={() => setActiveCollectionId("all")}
            />

            {physicalCollections.map((collection) => (
              <CollectionTab
                key={collection.id}
                active={activeCollectionId === collection.id}
                label={collection.name}
                onClick={() => setActiveCollectionId(collection.id)}
              />
            ))}

            <button
              type="button"
              onClick={() => {
                setNewCollectionKind("collection");
                setNewCollectionName("");
                setCollectionModalOpen(true);
              }}
              className="rounded-lg border border-dashed border-white/12 px-3 py-2 text-xs text-white/25 transition hover:border-white/25 hover:text-white/55"
            >
              +
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
            <span className="mr-1 text-[10px] uppercase tracking-[0.18em] text-[#c8b27a]/35">
              Lista de desejos
            </span>

            {wishlists.map((collection) => (
              <CollectionTab
                key={collection.id}
                active={activeCollectionId === collection.id}
                label={collection.name}
                wishlist
                onClick={() => setActiveCollectionId(collection.id)}
              />
            ))}

            <button
              type="button"
              onClick={() => {
                setNewCollectionKind("wishlist");
                setNewCollectionName("");
                setCollectionModalOpen(true);
              }}
              className="rounded-lg border border-dashed border-[#c8b27a]/15 px-3 py-2 text-xs text-[#e6d8b6]/30 transition hover:border-[#c8b27a]/30 hover:text-[#f4e7c5]/65"
            >
              + Nova lista
            </button>
          </div>

          {activeCollection && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
              <p className="mr-auto text-xs text-white/25">
                {activeCollection.kind === "wishlist"
                  ? "Lista de desejos selecionada"
                  : "Coleção selecionada"}
                :{" "}
                <span className="text-white/50">{activeCollection.name}</span>
              </p>

              <button
                type="button"
                onClick={() => void renameCollection(activeCollection)}
                className="rounded-lg px-3 py-2 text-xs text-white/25 transition hover:bg-white/[0.04] hover:text-white/55"
              >
                Renomear
              </button>

              <button
                type="button"
                onClick={() => void deleteCollection(activeCollection)}
                className="rounded-lg px-3 py-2 text-xs text-red-100/30 transition hover:bg-red-300/[0.05] hover:text-red-100/65"
              >
                Excluir
              </button>
            </div>
          )}
        </section>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat value={stats.unique} label="Cartas únicas" />
          <Stat value={stats.copies} label={activeCollection?.kind === "wishlist" ? "Cópias desejadas" : "Total de cópias"} />
          <Stat value={stats.sets} label="Edições diferentes" />
          <Stat
            value={stats.value > 0 ? formatUsd(stats.value) : "—"}
            label={
              activeCollection?.kind === "wishlist"
                ? "Custo estimado"
                : "Valor estimado"
            }
            footnote={
              stats.pricedCopies > 0
                ? `${stats.pricedCopies}/${stats.copies} cópias com preço`
                : undefined
            }
          />
        </div>

        <section className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.012] p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Distribuição por cor
            </p>

            {colorStats.length === 0 ? (
              <p className="mt-5 text-sm text-white/25">Sem dados ainda.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {colorStats.map((item) => {
                  const meta = manaMeta[item.color] ?? manaMeta.C;

                  return (
                    <div key={item.color}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[9px] font-semibold ${meta.className}`}
                          >
                            {item.color}
                          </span>
                          <span className="text-xs text-white/40">
                            {meta.label}
                          </span>
                        </div>

                        <span className="text-[11px] text-white/25">
                          {item.count}
                        </span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full bg-white/25"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.012] p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
              Distribuição por raridade
            </p>

            {rarityStats.length === 0 ? (
              <p className="mt-5 text-sm text-white/25">Sem dados ainda.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {rarityStats.map((item) => (
                  <div key={item.rarity}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="text-xs text-white/40">
                        {rarityLabels[item.rarity] ?? item.rarity}
                      </span>
                      <span className="text-[11px] text-white/25">
                        {item.count}
                      </span>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-[#c8b27a]/35"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-9 border-t border-white/10 pt-7">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_130px_155px_135px_135px_135px_135px]">
            <div>
              <Label>Procurar</Label>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, edição, coleção, idioma..."
                className="w-full rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-sm text-white/70 outline-none transition placeholder:text-white/20 focus:border-white/25"
              />
            </div>

            <Select
              label="Cor"
              value={colorFilter}
              onChange={setColorFilter}
              options={[
                ["Todas", "Todas"],
                ["W", "Branco"],
                ["U", "Azul"],
                ["B", "Preto"],
                ["R", "Vermelho"],
                ["G", "Verde"],
                ["C", "Incolor"],
              ]}
            />

            <Select
              label="Tipo"
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as TypeFilter)}
              options={typeOptions.map((value) => [value, value])}
            />

            <Select
              label="Edição"
              value={setFilter}
              onChange={setSetFilter}
              options={[
                ["Todos", "Todas"],
                ...sets.map((set) => [set, set]),
              ]}
            />

            <Select
              label="Raridade"
              value={rarityFilter}
              onChange={setRarityFilter}
              options={[
                ["Todas", "Todas"],
                ...rarities.map((rarity) => [
                  rarity,
                  rarityLabels[rarity] ?? rarity,
                ]),
              ]}
            />

            <Select
              label="Estado"
              value={conditionFilter}
              onChange={setConditionFilter}
              options={[
                ["Todos", "Todos"],
                ...Object.keys(conditionLabels).map((value) => [
                  value,
                  value,
                ]),
              ]}
            />

            <Select
              label="Acabamento"
              value={finishFilter}
              onChange={setFinishFilter}
              options={[
                ["Todos", "Todos"],
                ["normal", "Normal"],
                ["foil", "Foil"],
                ["etched", "Etched"],
              ]}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-2 text-sm text-white/30">
                {visibleCards.length}{" "}
                {visibleCards.length === 1
                  ? "item encontrado"
                  : "itens encontrados"}
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
                className={`rounded-lg border px-3 py-2 text-xs transition ${
                  selectionMode
                    ? "border-white/25 bg-white/[0.05] text-white/65"
                    : "border-white/10 text-white/30 hover:border-white/20 hover:text-white/55"
                }`}
              >
                {selectionMode ? "Sair da seleção" : "Selecionar várias"}
              </button>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-2 py-2 text-xs text-white/25 underline underline-offset-4 transition hover:text-white/55"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label>Ordenar</Label>
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as SortOption)
                  }
                  className="rounded-xl border border-white/10 bg-[#111114] px-3 py-2.5 text-xs text-white/50 outline-none"
                >
                  <option value="name_asc">Nome A–Z</option>
                  <option value="name_desc">Nome Z–A</option>
                  <option value="recent_desc">Mais recentes</option>
                  <option value="quantity_desc">Maior quantidade</option>
                  <option value="price_desc">Maior preço</option>
                  <option value="price_asc">Menor preço</option>
                  <option value="set_asc">Edição</option>
                  <option value="rarity_desc">Raridade</option>
                </select>
              </div>

              <div>
                <Label>Visualização</Label>
                <div className="inline-flex overflow-hidden rounded-xl border border-white/10 bg-[#111114]">
                  <ViewButton
                    active={viewMode === "grid"}
                    label="Grade"
                    onClick={() => setViewMode("grid")}
                  />
                  <ViewButton
                    active={viewMode === "compact"}
                    label="Compacto"
                    onClick={() => setViewMode("compact")}
                  />
                  <ViewButton
                    active={viewMode === "list"}
                    label="Lista"
                    onClick={() => setViewMode("list")}
                  />
                </div>
              </div>
            </div>
          </div>

          {selectionMode && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <span className="mr-2 text-xs text-white/45">
                {selectedIds.size} selecionada
                {selectedIds.size === 1 ? "" : "s"}
              </span>

              <button
                type="button"
                onClick={() => {
                  const allSelected =
                    visibleCards.length > 0 &&
                    visibleCards.every((row) => selectedIds.has(row.id));

                  setSelectedIds((current) => {
                    const next = new Set(current);

                    for (const row of visibleCards) {
                      if (allSelected) next.delete(row.id);
                      else next.add(row.id);
                    }

                    return next;
                  });
                }}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/35 transition hover:border-white/20 hover:text-white/60"
              >
                Selecionar visíveis
              </button>

              <BulkSelect
                disabled={bulkSaving || selectedIds.size === 0}
                defaultLabel="Mover para..."
                options={collections.map((collection) => [
                  collection.id,
                  `${collection.kind === "wishlist" ? "Desejos" : "Coleção"}: ${collection.name}`,
                ])}
                onChange={(value) =>
                  void bulkUpdate("collection_id", value)
                }
              />

              <BulkSelect
                disabled={bulkSaving || selectedIds.size === 0}
                defaultLabel="Estado..."
                options={Object.keys(conditionLabels).map((value) => [
                  value,
                  value,
                ])}
                onChange={(value) =>
                  void bulkUpdate("card_condition", value)
                }
              />

              <BulkSelect
                disabled={bulkSaving || selectedIds.size === 0}
                defaultLabel="Idioma..."
                options={Object.entries(languageLabels).map(([value, label]) => [
                  value,
                  label,
                ])}
                onChange={(value) => void bulkUpdate("language", value)}
              />

              <BulkSelect
                disabled={bulkSaving || selectedIds.size === 0}
                defaultLabel="Acabamento..."
                options={Object.entries(finishLabels).map(([value, label]) => [
                  value,
                  label,
                ])}
                onChange={(value) => void bulkUpdate("finish", value)}
              />

              <button
                type="button"
                disabled={bulkSaving || selectedIds.size === 0}
                onClick={() => void deleteSelected()}
                className="rounded-lg border border-red-300/15 px-3 py-2 text-xs text-red-100/40 transition hover:border-red-300/30 hover:text-red-100/70 disabled:opacity-35"
              >
                Remover selecionadas
              </button>
            </div>
          )}

          {scopedCards.length === 0 ? (
            <EmptyCollection
              wishlist={activeCollection?.kind === "wishlist"}
              onAdd={openAddModal}
            />
          ) : visibleCards.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center text-sm text-white/30">
              Nenhuma carta corresponde aos filtros atuais.
            </div>
          ) : viewMode === "grid" ? (
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {visibleCards.map((row) => (
                <GridCard
                  key={row.id}
                  row={row}
                  collectionName={
                    collections.find(
                      (collection) => collection.id === row.collection_id
                    )?.name ?? ""
                  }
                  selectionMode={selectionMode}
                  selected={selectedIds.has(row.id)}
                  saving={savingId === row.id}
                  onSelect={() => toggleSelection(row)}
                  onOpen={() => {
                    if (selectionMode) toggleSelection(row);
                    else setSelectedCard(row);
                  }}
                  onMinus={() =>
                    void changeQuantity(row, row.quantity - 1)
                  }
                  onPlus={() =>
                    void changeQuantity(row, row.quantity + 1)
                  }
                />
              ))}
            </div>
          ) : viewMode === "compact" ? (
            <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleCards.map((row) => (
                <CompactCard
                  key={row.id}
                  row={row}
                  collectionName={
                    collections.find(
                      (collection) => collection.id === row.collection_id
                    )?.name ?? ""
                  }
                  selectionMode={selectionMode}
                  selected={selectedIds.has(row.id)}
                  onSelect={() => toggleSelection(row)}
                  onOpen={() => {
                    if (selectionMode) toggleSelection(row);
                    else setSelectedCard(row);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.08]">
              <div className="hidden grid-cols-[40px_minmax(260px,1fr)_120px_110px_100px_100px_120px] gap-3 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[9px] uppercase tracking-[0.14em] text-white/20 md:grid">
                <span />
                <span>Carta</span>
                <span>Coleção</span>
                <span>Estado</span>
                <span>Idioma</span>
                <span>Qtd.</span>
                <span>Preço</span>
              </div>

              {visibleCards.map((row) => (
                <ListCard
                  key={row.id}
                  row={row}
                  collectionName={
                    collections.find(
                      (collection) => collection.id === row.collection_id
                    )?.name ?? ""
                  }
                  selectionMode={selectionMode}
                  selected={selectedIds.has(row.id)}
                  onSelect={() => toggleSelection(row)}
                  onOpen={() => {
                    if (selectionMode) toggleSelection(row);
                    else setSelectedCard(row);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {collectionModalOpen && (
        <CollectionModal
          name={newCollectionName}
          setName={setNewCollectionName}
          kind={newCollectionKind}
          setKind={setNewCollectionKind}
          saving={collectionSaving}
          onSave={() => void createCollection()}
          onClose={() => setCollectionModalOpen(false)}
        />
      )}

      {addOpen && (
        <AddModal
          search={addSearch}
          setSearch={handleAddSearchChange}
          results={addResults}
          searching={addSearching}
          error={addError}
          collections={collections}
          targetCollectionId={addTargetCollectionId}
          setTargetCollectionId={setAddTargetCollectionId}
          condition={addCondition}
          setCondition={setAddCondition}
          language={addLanguage}
          setLanguage={setAddLanguage}
          finish={addFinish}
          setFinish={setAddFinish}
          addingId={addingId}
          onAdd={(card) => void addCard(card)}
          onClose={() => setAddOpen(false)}
        />
      )}

      {selectedCard && (
        <DetailModal
          row={selectedCard}
          collections={collections}
          saving={savingId === selectedCard.id}
          onClose={() => setSelectedCard(null)}
          onMinus={() =>
            void changeQuantity(selectedCard, selectedCard.quantity - 1)
          }
          onPlus={() =>
            void changeQuantity(selectedCard, selectedCard.quantity + 1)
          }
          onRemove={() => void removeCard(selectedCard)}
          onUpdate={(patch) => void updateCardMeta(selectedCard, patch)}
        />
      )}
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25">
      {children}
    </label>
  );
}

function Stat({
  value,
  label,
  footnote,
}: {
  value: number | string;
  label: string;
  footnote?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-white/35">{label}</p>
      {footnote && (
        <p className="mt-2 text-[10px] text-white/18">{footnote}</p>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none transition focus:border-white/25"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function CollectionTab({
  active,
  label,
  wishlist = false,
  onClick,
}: {
  active: boolean;
  label: string;
  wishlist?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs transition ${
        active
          ? wishlist
            ? "border-[#c8b27a]/30 bg-[#c8b27a]/[0.07] text-[#eadab4]/70"
            : "border-white/25 bg-white/[0.055] text-white/70"
          : wishlist
            ? "border-[#c8b27a]/10 text-[#e6d8b6]/30 hover:border-[#c8b27a]/25 hover:text-[#f4e7c5]/60"
            : "border-white/10 text-white/30 hover:border-white/20 hover:text-white/55"
      }`}
    >
      {wishlist ? "♡ " : ""}
      {label}
    </button>
  );
}

function ViewButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-r border-white/10 px-3 py-2.5 text-[11px] transition last:border-r-0 ${
        active
          ? "bg-white/[0.07] text-white/70"
          : "text-white/28 hover:bg-white/[0.03] hover:text-white/55"
      }`}
    >
      {label}
    </button>
  );
}

function BulkSelect({
  disabled,
  defaultLabel,
  options,
  onChange,
}: {
  disabled: boolean;
  defaultLabel: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value=""
      disabled={disabled}
      onChange={(event) => {
        if (!event.target.value) return;
        onChange(event.target.value);
      }}
      className="rounded-lg border border-white/10 bg-[#111114] px-3 py-2 text-xs text-white/40 outline-none disabled:opacity-35"
    >
      <option value="">{defaultLabel}</option>
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

function EmptyCollection({
  wishlist,
  onAdd,
}: {
  wishlist: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-16 text-center">
      <p className="text-lg font-medium text-white/55">
        {wishlist
          ? "Sua lista de desejos está vazia."
          : "Esta coleção está vazia."}
      </p>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/25">
        {wishlist
          ? "Adicione cartas que você pretende adquirir."
          : "Adicione cartas para começar a organizar sua coleção física."}
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-6 rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white/60 transition hover:border-white/30 hover:text-white"
      >
        + Adicionar carta
      </button>
    </div>
  );
}

function SelectionCheck({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={active ? "Remover da seleção" : "Selecionar carta"}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`flex h-7 w-7 items-center justify-center rounded-md border text-[10px] transition ${
        active
          ? "border-white/35 bg-[#f4f1e8] text-black"
          : "border-white/15 bg-black/75 text-white/35 hover:border-white/30 hover:text-white"
      }`}
    >
      {active ? "✓" : ""}
    </button>
  );
}

function GridCard({
  row,
  collectionName,
  selectionMode,
  selected,
  saving,
  onSelect,
  onOpen,
  onMinus,
  onPlus,
}: {
  row: CollectionCard;
  collectionName: string;
  selectionMode: boolean;
  selected: boolean;
  saving: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const image = proxyImage(row.card.image);
  const price = getUnitPrice(row);

  return (
    <article className="group min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className={`relative block w-full overflow-hidden rounded-[4.6%] border bg-[#111114] text-left shadow-xl shadow-black/20 transition duration-200 hover:-translate-y-1 hover:border-white/25 ${
          selected
            ? "border-white/40 ring-2 ring-white/15"
            : "border-white/10"
        }`}
      >
        <div className="aspect-[488/680]">
          {image ? (
            <img
              src={image}
              alt={row.card.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-xs text-white/30">
              {row.card.name}
            </div>
          )}
        </div>

        {selectionMode && (
          <div className="absolute left-2 top-2 z-10">
            <SelectionCheck active={selected} onClick={onSelect} />
          </div>
        )}

        <span className="absolute right-2 top-2 rounded-lg border border-white/15 bg-black/75 px-2 py-1 text-xs font-semibold text-white/80 backdrop-blur-md">
          ×{row.quantity}
        </span>

        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
          <span className="rounded-md border border-white/12 bg-black/75 px-2 py-1 text-[9px] font-semibold text-white/55 backdrop-blur-md">
            {row.card_condition}
          </span>

          <span className="rounded-md border border-white/12 bg-black/75 px-2 py-1 text-[9px] uppercase text-white/45 backdrop-blur-md">
            {row.language}
          </span>

          {row.finish !== "normal" && (
            <span className="rounded-md border border-[#c8b27a]/20 bg-black/75 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-[#e6d8b6]/65 backdrop-blur-md">
              {finishLabels[row.finish]}
            </span>
          )}
        </div>
      </button>

      <div className="mt-3">
        <p className="truncate text-sm font-medium text-white/70">
          {row.card.name}
        </p>

        <p className="mt-1 truncate text-[10px] uppercase tracking-[0.09em] text-white/22">
          {row.card.set} · #{row.card.collector_number}
        </p>

        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-[10px] text-white/20">
            {collectionName}
          </p>
          <p className="shrink-0 text-[10px] text-white/30">
            {formatUsd(price)}
          </p>
        </div>

        <div className="mt-2 inline-flex overflow-hidden rounded-lg border border-white/10">
          <button
            type="button"
            disabled={saving}
            onClick={onMinus}
            className="h-8 w-8 text-white/35 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-35"
          >
            −
          </button>

          <span className="flex min-w-9 items-center justify-center border-x border-white/10 px-2 text-xs text-white/55">
            {row.quantity}
          </span>

          <button
            type="button"
            disabled={saving}
            onClick={onPlus}
            className="h-8 w-8 text-white/35 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-35"
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

function CompactCard({
  row,
  collectionName,
  selectionMode,
  selected,
  onSelect,
  onOpen,
}: {
  row: CollectionCard;
  collectionName: string;
  selectionMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const image = proxyImage(row.card.image);
  const price = getUnitPrice(row);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex items-center gap-3 rounded-xl border bg-white/[0.018] p-3 text-left transition hover:bg-white/[0.035] ${
        selected ? "border-white/35" : "border-white/[0.08] hover:border-white/18"
      }`}
    >
      {selectionMode && (
        <SelectionCheck active={selected} onClick={onSelect} />
      )}

      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-[#121216]">
        {image ? (
          <img
            src={image}
            alt={row.card.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white/70">
          {row.card.name}
        </p>
        <p className="mt-1 truncate text-[10px] uppercase tracking-[0.09em] text-white/22">
          {row.card.set} · #{row.card.collector_number}
        </p>
        <p className="mt-2 truncate text-[10px] text-white/22">
          {collectionName} · {row.card_condition} · {row.language.toUpperCase()}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-white/60">×{row.quantity}</p>
        <p className="mt-1 text-[10px] text-white/25">{formatUsd(price)}</p>
      </div>
    </button>
  );
}

function ListCard({
  row,
  collectionName,
  selectionMode,
  selected,
  onSelect,
  onOpen,
}: {
  row: CollectionCard;
  collectionName: string;
  selectionMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const image = proxyImage(row.card.image);
  const price = getUnitPrice(row);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`grid w-full grid-cols-[40px_minmax(0,1fr)] items-center gap-3 border-b border-white/[0.055] px-4 py-3 text-left transition last:border-b-0 hover:bg-white/[0.03] md:grid-cols-[40px_minmax(260px,1fr)_120px_110px_100px_100px_120px] ${
        selected ? "bg-white/[0.045]" : ""
      }`}
    >
      <div className="flex items-center justify-center">
        {selectionMode ? (
          <SelectionCheck active={selected} onClick={onSelect} />
        ) : (
          <div className="h-12 w-9 overflow-hidden rounded border border-white/[0.08] bg-[#121216]">
            {image ? (
              <img
                src={image}
                alt={row.card.name}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white/65">
          {row.card.name}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-white/20">
          {row.card.set} #{row.card.collector_number} · {finishLabels[row.finish]}
        </p>
      </div>

      <span className="hidden truncate text-xs text-white/30 md:block">
        {collectionName}
      </span>
      <span className="hidden text-xs text-white/35 md:block">
        {row.card_condition}
      </span>
      <span className="hidden text-xs text-white/30 md:block">
        {languageName(row.language)}
      </span>
      <span className="hidden text-xs font-semibold text-white/45 md:block">
        ×{row.quantity}
      </span>
      <span className="hidden text-xs text-white/35 md:block">
        {formatUsd(price)}
      </span>
    </button>
  );
}

function CollectionModal({
  name,
  setName,
  kind,
  setKind,
  saving,
  onSave,
  onClose,
}: {
  name: string;
  setName: (value: string) => void;
  kind: CollectionKind;
  setKind: (value: CollectionKind) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#101013] p-6 shadow-2xl">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#c8b27a]/45">
          Organização
        </p>
        <h2 className="mt-2 text-xl font-semibold">Nova coleção</h2>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setKind("collection")}
            className={`rounded-xl border px-3 py-3 text-sm transition ${
              kind === "collection"
                ? "border-white/25 bg-white/[0.05] text-white/70"
                : "border-white/10 text-white/30 hover:border-white/20"
            }`}
          >
            Coleção física
          </button>

          <button
            type="button"
            onClick={() => setKind("wishlist")}
            className={`rounded-xl border px-3 py-3 text-sm transition ${
              kind === "wishlist"
                ? "border-[#c8b27a]/30 bg-[#c8b27a]/[0.05] text-[#e7d8b4]/65"
                : "border-white/10 text-white/30 hover:border-white/20"
            }`}
          >
            Lista de desejos
          </button>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSave();
          }}
          maxLength={80}
          placeholder={
            kind === "wishlist" ? "Ex.: Quero comprar" : "Ex.: Fichário principal"
          }
          className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70 outline-none placeholder:text-white/20 focus:border-white/25"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/40 transition hover:border-white/20 hover:text-white/65"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={onSave}
            className="rounded-lg bg-[#f4f1e8] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-40"
          >
            {saving ? "Criando..." : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddModal({
  search,
  setSearch,
  results,
  searching,
  error,
  collections,
  targetCollectionId,
  setTargetCollectionId,
  condition,
  setCondition,
  language,
  setLanguage,
  finish,
  setFinish,
  addingId,
  onAdd,
  onClose,
}: {
  search: string;
  setSearch: (value: string) => void;
  results: CardMeta[];
  searching: boolean;
  error: string;
  collections: UserCollection[];
  targetCollectionId: string;
  setTargetCollectionId: (value: string) => void;
  condition: CardCondition;
  setCondition: (value: CardCondition) => void;
  language: string;
  setLanguage: (value: string) => void;
  finish: Finish;
  setFinish: (value: Finish) => void;
  addingId: string | null;
  onAdd: (card: CardMeta) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101013] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#c8b27a]/50">
              Minha coleção
            </p>
            <h2 className="mt-1 text-xl font-semibold">Adicionar carta</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/35 transition hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3 border-b border-white/[0.07] p-6 lg:grid-cols-[minmax(260px,1fr)_190px_155px_165px_150px]">
          <div>
            <Label>Procurar impressão</Label>
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex.: Sol Ring"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 outline-none placeholder:text-white/20 focus:border-white/25"
            />
          </div>

          <div>
            <Label>Destino</Label>
            <select
              value={targetCollectionId}
              onChange={(event) => setTargetCollectionId(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none"
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.kind === "wishlist" ? "♡ " : ""}
                  {collection.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Estado</Label>
            <select
              value={condition}
              onChange={(event) =>
                setCondition(event.target.value as CardCondition)
              }
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none"
            >
              {Object.entries(conditionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Idioma</Label>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none"
            >
              <option value="auto">Da impressão</option>
              {Object.entries(languageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Acabamento</Label>
            <select
              value={finish}
              onChange={(event) => setFinish(event.target.value as Finish)}
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none"
            >
              <option value="normal">Normal</option>
              <option value="foil">Foil</option>
              <option value="etched">Etched</option>
            </select>
          </div>

          {error && (
            <p className="lg:col-span-5 text-sm text-red-100/55">{error}</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {search.trim().length < 2 ? (
            <p className="py-14 text-center text-sm text-white/25">
              Digite pelo menos 2 letras para procurar.
            </p>
          ) : searching ? (
            <p className="py-14 text-center text-sm text-white/25">
              Procurando...
            </p>
          ) : results.length === 0 ? (
            <p className="py-14 text-center text-sm text-white/25">
              Nenhuma impressão encontrada.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {results.map((card) => {
                const image = proxyImage(card.image);
                const selectedPrice =
                  finish === "foil"
                    ? card.prices.usd_foil
                    : finish === "etched"
                      ? card.prices.usd_etched
                      : card.prices.usd;

                return (
                  <div key={card.scryfall_id} className="min-w-0">
                    <div className="overflow-hidden rounded-[4.6%] border border-white/10 bg-[#121216]">
                      <div className="aspect-[488/680]">
                        {image ? (
                          <img
                            src={image}
                            alt={card.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-white/30">
                            {card.name}
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="mt-2 truncate text-xs font-medium text-white/65">
                      {card.name}
                    </p>

                    <p className="mt-1 truncate text-[9px] uppercase tracking-[0.1em] text-white/25">
                      {card.set} · #{card.collector_number} · {card.lang.toUpperCase()}
                    </p>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[9px] text-white/20">
                        {rarityLabels[card.rarity] ?? card.rarity}
                      </span>
                      <span className="text-[9px] text-white/30">
                        {formatUsd(selectedPrice)}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={addingId !== null || !targetCollectionId}
                      onClick={() => onAdd(card)}
                      className="mt-2 w-full rounded-lg border border-white/10 px-2 py-2 text-[11px] text-white/45 transition hover:border-white/25 hover:bg-white/[0.04] hover:text-white/75 disabled:opacity-35"
                    >
                      {addingId === card.scryfall_id
                        ? "Adicionando..."
                        : "+ Adicionar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailModal({
  row,
  collections,
  saving,
  onClose,
  onMinus,
  onPlus,
  onRemove,
  onUpdate,
}: {
  row: CollectionCard;
  collections: UserCollection[];
  saving: boolean;
  onClose: () => void;
  onMinus: () => void;
  onPlus: () => void;
  onRemove: () => void;
  onUpdate: (
    patch: Partial<
      Pick<
        CollectionRow,
        "collection_id" | "card_condition" | "language" | "finish"
      >
    >
  ) => void;
}) {
  const image = proxyImage(row.card.image);
  const price = getUnitPrice(row);

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-[#101013] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-white/35 transition hover:text-white"
        >
          ×
        </button>

        <div className="grid gap-7 md:grid-cols-[240px_1fr]">
          <div className="overflow-hidden rounded-[4.6%] border border-white/10 bg-[#111114]">
            <div className="aspect-[488/680]">
              {image ? (
                <img
                  src={image}
                  alt={row.card.name}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          </div>

          <div className="min-w-0 self-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#c8b27a]/50">
              {row.card.set_name}
            </p>

            <h2 className="mt-2 text-3xl font-semibold">{row.card.name}</h2>

            <p className="mt-3 text-sm text-white/35">
              {row.card.type_line || "Tipo não informado"}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <EditableSelect
                label="Coleção"
                value={row.collection_id}
                disabled={saving}
                onChange={(value) => onUpdate({ collection_id: value })}
                options={collections.map((collection) => [
                  collection.id,
                  `${collection.kind === "wishlist" ? "♡ " : ""}${collection.name}`,
                ])}
              />

              <EditableSelect
                label="Estado"
                value={row.card_condition}
                disabled={saving}
                onChange={(value) =>
                  onUpdate({ card_condition: value as CardCondition })
                }
                options={Object.entries(conditionLabels)}
              />

              <EditableSelect
                label="Idioma"
                value={row.language}
                disabled={saving}
                onChange={(value) => onUpdate({ language: value })}
                options={Object.entries(languageLabels)}
              />

              <EditableSelect
                label="Acabamento"
                value={row.finish}
                disabled={saving}
                onChange={(value) => onUpdate({ finish: value as Finish })}
                options={Object.entries(finishLabels)}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Detail label="Edição" value={row.card.set} />
              <Detail label="Número" value={`#${row.card.collector_number}`} />
              <Detail
                label="Raridade"
                value={rarityLabels[row.card.rarity] ?? row.card.rarity}
              />
              <Detail label="Preço unitário" value={formatUsd(price)} />
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="inline-flex overflow-hidden rounded-xl border border-white/10">
                <button
                  type="button"
                  disabled={saving}
                  onClick={onMinus}
                  className="h-10 w-10 text-white/40 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-35"
                >
                  −
                </button>

                <span className="flex min-w-12 items-center justify-center border-x border-white/10 px-3 text-sm text-white/65">
                  {row.quantity}
                </span>

                <button
                  type="button"
                  disabled={saving}
                  onClick={onPlus}
                  className="h-10 w-10 text-white/40 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-35"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={onRemove}
                className="rounded-xl border border-red-300/15 px-4 py-2.5 text-sm text-red-100/45 transition hover:border-red-300/30 hover:text-red-100/70 disabled:opacity-35"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableSelect({
  label,
  value,
  disabled,
  onChange,
  options,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none disabled:opacity-45"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] px-3 py-3">
      <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
        {label}
      </p>
      <p className="mt-1 truncate text-sm text-white/55">{value || "—"}</p>
    </div>
  );
}
