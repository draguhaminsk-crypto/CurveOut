"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

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

type ScryfallImageUris = {
  small?: string;
  normal?: string;
  large?: string;
};

type ScryfallCardFace = {
  name?: string;
  image_uris?: ScryfallImageUris;
};

type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  requested_name?: string;
  type_line?: string;
  mana_cost?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  lang?: string;
  released_at?: string;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
};

type ScryfallSearchResponse = {
  data?: ScryfallCard[];
  details?: string;
};

type ImportBoard =
  | "mainboard"
  | "commander"
  | "sideboard"
  | "maybeboard";

type ImportedCard = {
  quantity: number;
  name: string;
  board: ImportBoard;
  original: string;
};

function getCardImage(card: ScryfallCard) {
  return (
    card.image_uris?.normal ??
    card.image_uris?.large ??
    card.card_faces?.find((face) => face.image_uris?.normal)?.image_uris
      ?.normal ??
    card.card_faces?.find((face) => face.image_uris?.large)?.image_uris
      ?.large ??
    null
  );
}

function cleanImportedCardName(rawName: string) {
  return rawName
    .replace(/\s+\([A-Z0-9]{2,8}\)\s+\S+\s*$/i, "")
    .replace(/\s+\[[A-Z0-9]{2,8}\]\s*$/i, "")
    .replace(/\s+\([A-Z0-9]{2,8}\)\s*$/i, "")
    .trim();
}

function parseImportedList(value: string): ImportedCard[] {
  const lines = value.split(/\r?\n/);
  const cards: ImportedCard[] = [];
  let currentBoard: ImportBoard = "mainboard";

  const sectionMap: Record<string, ImportBoard> = {
    commander: "commander",
    commanders: "commander",
    "command zone": "commander",
    deck: "mainboard",
    mainboard: "mainboard",
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
    maybeboard: "maybeboard",
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

    const normalizedLine = line.replace(/^[-•]\s*/, "").trim();
    const match = normalizedLine.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (!match) continue;

    const quantity = Number(match[1]);
    const name = cleanImportedCardName(match[2]);
    if (!quantity || !name) continue;

    cards.push({
      quantity,
      name,
      board: currentBoard,
      original: line,
    });
  }

  return cards;
}

export default function NovoDeckPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [name, setName] = useState("");
  const [format, setFormat] = useState("Commander");
  const [isPublic, setIsPublic] = useState(true);

  const [commanderSearch, setCommanderSearch] = useState("");
  const [commanderResults, setCommanderResults] = useState<ScryfallCard[]>([]);
  const [selectedCommander, setSelectedCommander] =
    useState<ScryfallCard | null>(null);
  const [commanderLoading, setCommanderLoading] = useState(false);
  const [commanderError, setCommanderError] = useState("");

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const [checkingUser, setCheckingUser] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const importedCards = useMemo(
    () => parseImportedList(importText),
    [importText]
  );

  const importedQuantity = useMemo(
    () =>
      importedCards.reduce(
        (total, importedCard) => total + importedCard.quantity,
        0
      ),
    [importedCards]
  );

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: preferences, error: preferencesError } = await supabase
        .from("profiles")
        .select("default_deck_public")
        .eq("id", user.id)
        .maybeSingle();

      if (!preferencesError && preferences) {
        setIsPublic(preferences.default_deck_public ?? true);
      }

      setCheckingUser(false);
    }

    checkUser();
  }, [router, supabase]);

  useEffect(() => {
    let cancelled = false;

    async function loadCommanderFromUrl() {
      const searchParams = new URLSearchParams(window.location.search);
      const commanderId = searchParams.get("commander");

      if (!commanderId) {
        return;
      }

      setCommanderLoading(true);
      setCommanderError("");

      const { data, error } = await supabase
        .from("cards")
        .select(
          "scryfall_id, oracle_id, name, type_line, mana_cost, image_uri, image_uri_large, card_data"
        )
        .eq("scryfall_id", commanderId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "Erro ao carregar comandante selecionado na Home:",
          error
        );
        setCommanderError(
          "Não foi possível carregar o comandante selecionado."
        );
        setCommanderLoading(false);
        return;
      }

      if (!data) {
        setCommanderError(
          "O comandante selecionado não foi encontrado na base do CurveOut."
        );
        setCommanderLoading(false);
        return;
      }

      const cardData =
        typeof data.card_data === "object" &&
        data.card_data !== null &&
        !Array.isArray(data.card_data)
          ? (data.card_data as Record<string, unknown>)
          : {};

      const cardFaces: ScryfallCardFace[] | undefined =
        Array.isArray(cardData.card_faces)
          ? cardData.card_faces.flatMap(
              (face): ScryfallCardFace[] => {
                if (
                  typeof face !== "object" ||
                  face === null ||
                  Array.isArray(face)
                ) {
                  return [];
                }

                const faceRecord =
                  face as Record<string, unknown>;

                const imageUris =
                  typeof faceRecord.image_uris === "object" &&
                  faceRecord.image_uris !== null &&
                  !Array.isArray(faceRecord.image_uris)
                    ? (faceRecord.image_uris as Record<
                        string,
                        unknown
                      >)
                    : {};

                const parsedFace: ScryfallCardFace = {};
                const parsedImageUris: ScryfallImageUris = {};

                if (typeof faceRecord.name === "string") {
                  parsedFace.name = faceRecord.name;
                }

                if (typeof imageUris.normal === "string") {
                  parsedImageUris.normal = imageUris.normal;
                }

                if (typeof imageUris.large === "string") {
                  parsedImageUris.large = imageUris.large;
                }

                if (
                  parsedImageUris.normal ||
                  parsedImageUris.large
                ) {
                  parsedFace.image_uris = parsedImageUris;
                }

                return [parsedFace];
              }
            )
          : undefined;

      const commander: ScryfallCard = {
        id: data.scryfall_id,
        oracle_id: data.oracle_id ?? undefined,
        name: data.name,
        type_line: data.type_line ?? undefined,
        mana_cost: data.mana_cost ?? undefined,
        set:
          typeof cardData.set === "string"
            ? cardData.set
            : undefined,
        set_name:
          typeof cardData.set_name === "string"
            ? cardData.set_name
            : undefined,
        collector_number:
          typeof cardData.collector_number === "string"
            ? cardData.collector_number
            : undefined,
        lang:
          typeof cardData.lang === "string"
            ? cardData.lang
            : "en",
        released_at:
          typeof cardData.released_at === "string"
            ? cardData.released_at
            : undefined,
        image_uris: {
          normal: data.image_uri ?? undefined,
          large: data.image_uri_large ?? undefined,
        },
        card_faces: cardFaces,
      };

      setFormat("Commander");
      setSelectedCommander(commander);
      setCommanderSearch(commander.name);
      setCommanderResults([]);
      setCommanderError("");
      setCommanderLoading(false);
    }

    void loadCommanderFromUrl();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (format !== "Commander") return;

    const query = commanderSearch.trim();

    if (query.length < 2) {
      return;
    }

    if (selectedCommander && query === selectedCommander.name) {
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setCommanderLoading(true);
      setCommanderError("");

      try {
        const scryfallQuery = `${query} is:commander game:paper`;
        const response = await fetch(
          `https://api.scryfall.com/cards/search?q=${encodeURIComponent(
            scryfallQuery
          )}&unique=cards&order=name`,
          {
            signal: controller.signal,
          }
        );

        const result = (await response.json()) as ScryfallSearchResponse;

        if (!response.ok) {
          setCommanderResults([]);

          if (response.status === 404) {
            setCommanderError("Nenhum comandante encontrado.");
          } else {
            setCommanderError(
              result.details || "Não foi possível buscar no Scryfall."
            );
          }

          return;
        }

        setCommanderResults((result.data ?? []).slice(0, 8));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Erro ao buscar comandante:", error);
        setCommanderResults([]);
        setCommanderError("Não foi possível buscar no Scryfall.");
      } finally {
        if (!controller.signal.aborted) {
          setCommanderLoading(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [commanderSearch, format, selectedCommander]);

  function selectCommander(card: ScryfallCard) {
    setSelectedCommander(card);
    setCommanderSearch(card.name);
    setCommanderResults([]);
    setCommanderError("");
  }

  function clearCommander() {
    setSelectedCommander(null);
    setCommanderSearch("");
    setCommanderResults([]);
    setCommanderError("");
  }

  async function resolveImportedCards() {
    if (importedCards.length === 0) {
      return {
        resolved: [] as Array<{ imported: ImportedCard; card: ScryfallCard }>,
        missing: [] as string[],
      };
    }

    const uniqueNames = Array.from(
      new Set(importedCards.map((card) => card.name.trim()).filter(Boolean))
    );

    const response = await fetch("/api/scryfall/cards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        identifiers: uniqueNames.map((cardName) => ({ name: cardName })),
      }),
    });

    const result = (await response.json()) as {
      cards?: ScryfallCard[];
      notFound?: Array<{ name?: string }>;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(
        result.error || "Não foi possível consultar as cartas da lista."
      );
    }

    const byName = new Map<string, ScryfallCard>();

    for (const card of result.cards ?? []) {
      if (card.requested_name) {
        byName.set(
          card.requested_name.trim().toLocaleLowerCase("en-US"),
          card
        );
      }

      byName.set(card.name.trim().toLocaleLowerCase("en-US"), card);
    }

    const missing = uniqueNames.filter(
      (cardName) => !byName.has(cardName.toLocaleLowerCase("en-US"))
    );

    const resolved = importedCards.flatMap((imported) => {
      const card = byName.get(imported.name.toLocaleLowerCase("en-US"));
      return card ? [{ imported, card }] : [];
    });

    return { resolved, missing };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      setErrorMessage("Digite um nome para o deck.");
      return;
    }

    setCreating(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCreating(false);
      router.replace("/auth/login");
      return;
    }

    let resolvedImport: Awaited<ReturnType<typeof resolveImportedCards>> = {
      resolved: [],
      missing: [],
    };

    try {
      resolvedImport = await resolveImportedCards();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar a importação."
      );
      setCreating(false);
      return;
    }

    if (resolvedImport.missing.length > 0) {
      setErrorMessage(
        `Não encontrei ${resolvedImport.missing.length} carta(s): ${resolvedImport.missing
          .slice(0, 8)
          .join(", ")}${resolvedImport.missing.length > 8 ? "…" : ""}`
      );
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from("decks")
      .insert({
        owner_id: user.id,
        name: cleanName,
        format,
        is_public: isPublic,
        commander_scryfall_id:
          format === "Commander" ? selectedCommander?.id ?? null : null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Erro ao criar deck:", error);
      setErrorMessage(`Erro: ${error.message}`);
      setCreating(false);
      return;
    }

    if (format === "Commander" && selectedCommander) {
      const commanderImage =
        selectedCommander.image_uris?.normal ??
        selectedCommander.card_faces?.find(
          (face) => face.image_uris?.normal
        )?.image_uris?.normal ??
        null;

      const commanderImageLarge =
        selectedCommander.image_uris?.large ??
        selectedCommander.card_faces?.find(
          (face) => face.image_uris?.large
        )?.image_uris?.large ??
        commanderImage;

      const printingData = {
        scryfall_id: selectedCommander.id,
        oracle_id: selectedCommander.oracle_id ?? null,
        name: selectedCommander.name,
        type_line: selectedCommander.type_line ?? null,
        image_uri: commanderImage,
        image_uri_large: commanderImageLarge,
        set: selectedCommander.set ?? "",
        set_name: selectedCommander.set_name ?? "",
        collector_number: selectedCommander.collector_number ?? "",
        lang: selectedCommander.lang ?? "en",
        released_at: selectedCommander.released_at ?? "",
      };

      const { error: commanderInsertError } = await supabase
        .from("deck_cards")
        .insert({
          deck_id: data.id,
          scryfall_id: selectedCommander.id,
          oracle_id: selectedCommander.oracle_id ?? null,
          quantity: 1,
          board: "commander",
          manual_category: null,
          printing_data: printingData,
        });

      if (commanderInsertError) {
        console.error(
          "Erro ao adicionar comandante ao deck:",
          commanderInsertError
        );

        // Se o comandante não puder ser gravado, desfaz a criação para
        // não deixar um deck Commander incompleto perdido em Meus decks.
        await supabase
          .from("decks")
          .delete()
          .eq("id", data.id)
          .eq("owner_id", user.id);

        setErrorMessage(
          `Não foi possível definir o comandante: ${commanderInsertError.message}`
        );
        setCreating(false);
        return;
      }
    }

    if (resolvedImport.resolved.length > 0) {
      const merged = new Map<
        string,
        { imported: ImportedCard; card: ScryfallCard; quantity: number }
      >();

      for (const entry of resolvedImport.resolved) {
        const key = `${entry.card.id}:${entry.imported.board}`;
        const current = merged.get(key);

        merged.set(key, {
          imported: entry.imported,
          card: entry.card,
          quantity: (current?.quantity ?? 0) + entry.imported.quantity,
        });
      }

      const rowsToInsert = Array.from(merged.values()).flatMap((entry) => {
        const duplicatesSelectedCommander =
          format === "Commander" &&
          selectedCommander?.id === entry.card.id &&
          entry.imported.board === "commander";

        if (duplicatesSelectedCommander) {
          return [];
        }

        const imageNormal =
          entry.card.image_uris?.normal ??
          entry.card.card_faces?.find((face) => face.image_uris?.normal)
            ?.image_uris?.normal ??
          null;
        const imageLarge =
          entry.card.image_uris?.large ??
          entry.card.card_faces?.find((face) => face.image_uris?.large)
            ?.image_uris?.large ??
          imageNormal;

        return [
          {
            deck_id: data.id,
            scryfall_id: entry.card.id,
            oracle_id: entry.card.oracle_id ?? null,
            quantity: entry.quantity,
            board: entry.imported.board,
            manual_category: null,
            printing_data: {
              scryfall_id: entry.card.id,
              oracle_id: entry.card.oracle_id ?? null,
              name: entry.card.name,
              type_line: entry.card.type_line ?? null,
              image_uri: imageNormal,
              image_uri_large: imageLarge,
              set: entry.card.set ?? "",
              set_name: entry.card.set_name ?? "",
              collector_number: entry.card.collector_number ?? "",
              lang: entry.card.lang ?? "en",
              released_at: entry.card.released_at ?? "",
            },
          },
        ];
      });

      if (rowsToInsert.length > 0) {
        const { error: importInsertError } = await supabase
          .from("deck_cards")
          .insert(rowsToInsert);

        if (importInsertError) {
          await supabase
            .from("decks")
            .delete()
            .eq("id", data.id)
            .eq("owner_id", user.id);

          setErrorMessage(
            `Não foi possível importar as cartas: ${importInsertError.message}`
          );
          setCreating(false);
          return;
        }
      }

      if (!selectedCommander && format === "Commander") {
        const importedCommander = Array.from(merged.values()).find(
          (entry) => entry.imported.board === "commander"
        );

        if (importedCommander) {
          await supabase
            .from("decks")
            .update({ commander_scryfall_id: importedCommander.card.id })
            .eq("id", data.id)
            .eq("owner_id", user.id);
        }
      }
    }

    router.push(`/decks/${data.id}`);
    router.refresh();
  }

  if (checkingUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-[#f4f1e8]">
        <p className="text-sm text-white/40">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-6 py-10 text-[#f4f1e8] md:px-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm text-white/40 transition hover:text-white"
        >
          ← CurveOut
        </Link>

        <header className="mt-10 border-b border-white/10 pb-8">
          <p className="text-xs uppercase tracking-[0.22em] text-white/30">
            Deckbuilding
          </p>

          <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
            Criar deck
          </h1>

          <p className="mt-4 max-w-xl leading-7 text-white/40">
            Dê um nome ao seu deck, escolha o formato e comece a construir.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="py-10">
          {/* NOME */}
          <div>
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
              autoFocus
              autoComplete="off"
              placeholder="Ex: Sauron Reanimator"
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 text-[#f4f1e8] outline-none transition placeholder:text-white/20 focus:border-white/30"
            />

            <div className="mt-2 text-right text-xs text-white/20">
              {name.length}/80
            </div>
          </div>

          {/* FORMATO */}
          <div className="mt-8">
            <label
              htmlFor="deck-format"
              className="text-sm font-medium text-white/70"
            >
              Formato
            </label>

            <select
              id="deck-format"
              value={format}
              onChange={(event) => {
                const nextFormat = event.target.value;

                setFormat(nextFormat);

                if (nextFormat !== "Commander") {
                  setCommanderSearch("");
                  setCommanderResults([]);
                  setSelectedCommander(null);
                  setCommanderLoading(false);
                  setCommanderError("");
                }
              }}
              className="mt-3 w-full rounded-xl border border-white/10 bg-[#111114] px-4 py-3.5 text-[#f4f1e8] outline-none transition focus:border-white/30"
            >
              {formats.map((deckFormat) => (
                <option key={deckFormat} value={deckFormat}>
                  {deckFormat}
                </option>
              ))}
            </select>
          </div>

          {/* COMANDANTE */}
          {format === "Commander" && (
            <div className="mt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <label
                    htmlFor="commander-search"
                    className="text-sm font-medium text-white/70"
                  >
                    Comandante
                  </label>

                  <p className="mt-1 text-xs text-white/25">
                    Busque uma carta válida como comandante.
                  </p>
                </div>

                {selectedCommander && (
                  <button
                    type="button"
                    onClick={clearCommander}
                    className="text-xs text-white/35 transition hover:text-white"
                  >
                    Remover
                  </button>
                )}
              </div>

              <div className="relative mt-3">
                <input
                  id="commander-search"
                  type="text"
                  value={commanderSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCommanderSearch(value);

                    if (value.trim().length < 2) {
                      setCommanderResults([]);
                      setCommanderLoading(false);
                      setCommanderError("");
                    }

                    if (
                      selectedCommander &&
                      value !== selectedCommander.name
                    ) {
                      setSelectedCommander(null);
                    }
                  }}
                  autoComplete="off"
                  placeholder="Ex: Sauron, the Dark Lord"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 pr-28 text-[#f4f1e8] outline-none transition placeholder:text-white/20 focus:border-white/30"
                />

                {commanderLoading && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/30">
                    Buscando...
                  </span>
                )}

                {!selectedCommander && commanderResults.length > 0 && (
                  <div className="absolute z-20 mt-2 max-h-[420px] w-full overflow-y-auto rounded-xl border border-white/10 bg-[#111114] p-2 shadow-2xl shadow-black/50">
                    {commanderResults.map((card) => {
                      const cardImage = getCardImage(card);

                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => selectCommander(card)}
                          className="flex w-full items-center gap-4 rounded-lg p-3 text-left transition hover:bg-white/[0.06]"
                        >
                          <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
                            {cardImage ? (
                              <img
                                src={cardImage}
                                alt={card.name}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-white/85">
                              {card.name}
                            </p>

                            <p className="mt-1 truncate text-xs text-white/35">
                              {card.type_line || "Magic card"}
                            </p>

                            <p className="mt-1 text-xs text-white/20">
                              {card.set_name || card.set?.toUpperCase()}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {commanderError && !selectedCommander && (
                <p className="mt-2 text-xs text-red-300/80">
                  {commanderError}
                </p>
              )}

              {selectedCommander && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
                  <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
                    {getCardImage(selectedCommander) && (
                      <img
                        src={getCardImage(selectedCommander) ?? ""}
                        alt={selectedCommander.name}
                        className="w-24 shrink-0 rounded-[7%] shadow-lg shadow-black/40"
                      />
                    )}

                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/25">
                        Comandante escolhido
                      </p>

                      <h2 className="mt-2 text-xl font-semibold text-[#f4f1e8]">
                        {selectedCommander.name}
                      </h2>

                      <p className="mt-2 text-sm text-white/40">
                        {selectedCommander.type_line}
                      </p>

                      {selectedCommander.set_name && (
                        <p className="mt-2 text-xs text-white/25">
                          {selectedCommander.set_name}
                          {selectedCommander.collector_number
                            ? ` · #${selectedCommander.collector_number}`
                            : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* IMPORTAR LISTA */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.015]">
            <button
              type="button"
              onClick={() => setShowImport((current) => !current)}
              className="flex w-full items-center justify-between gap-6 p-5 text-left"
            >
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-white/70">
                    Importar lista
                  </p>

                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/25">
                    Opcional
                  </span>
                </div>

                <p className="mt-1 text-xs text-white/25">
                  Cole uma decklist para preparar várias cartas de uma vez.
                </p>
              </div>

              <span className="text-lg text-white/30">
                {showImport ? "−" : "+"}
              </span>
            </button>

            {showImport && (
              <div className="border-t border-white/10 p-5">
                <textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  rows={9}
                  spellCheck={false}
                  placeholder={`1 Sol Ring\n1 Arcane Signet\n1 Command Tower\n1 Counterspell`}
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#111114] px-4 py-3.5 font-mono text-sm leading-6 text-[#f4f1e8] outline-none transition placeholder:text-white/15 focus:border-white/30"
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-white/25">
                    Formatos aceitos por enquanto: “1 Sol Ring” e “1x Sol Ring”.
                  </p>

                  {importText.trim() && (
                    <div className="text-right">
                      <p className="text-sm text-white/60">
                        {importedQuantity} carta
                        {importedQuantity === 1 ? "" : "s"} reconhecida
                        {importedQuantity === 1 ? "" : "s"}
                      </p>

                      <p className="mt-0.5 text-xs text-white/25">
                        {importedCards.length} nome
                        {importedCards.length === 1 ? "" : "s"} na lista
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-lg border border-amber-200/10 bg-amber-200/[0.025] px-4 py-3 text-xs leading-5 text-white/30">
                  Ao criar o deck, o CurveOut vai localizar estas cartas e
                  adicioná-las automaticamente ao deck. Se algum nome não for
                  encontrado, a criação é interrompida para você corrigir a lista.
                </div>
              </div>
            )}
          </div>

          {/* VISIBILIDADE */}
          <div className="mt-8">
            <p className="text-sm font-medium text-white/70">Visibilidade</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`rounded-xl border p-4 text-left transition ${
                  isPublic
                    ? "border-white/30 bg-white/[0.07]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <p className="font-medium text-white/85">Público</p>

                <p className="mt-1 text-sm leading-6 text-white/35">
                  Outros usuários poderão visualizar este deck.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`rounded-xl border p-4 text-left transition ${
                  !isPublic
                    ? "border-white/30 bg-white/[0.07]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <p className="font-medium text-white/85">Privado</p>

                <p className="mt-1 text-sm leading-6 text-white/35">
                  Somente você poderá visualizar este deck.
                </p>
              </button>
            </div>
          </div>

          {errorMessage && (
            <p className="mt-6 text-sm text-red-300">{errorMessage}</p>
          )}

          {/* AÇÕES */}
          <div className="mt-10 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-8">
            <Link
              href="/meus-decks"
              className="rounded-lg px-5 py-2.5 text-sm text-white/45 transition hover:text-white"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="rounded-lg bg-[#f4f1e8] px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              {creating ? "Criando..." : "Criar deck"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}