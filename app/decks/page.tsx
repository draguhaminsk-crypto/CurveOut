"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type DeckRow = {
  id: string;
  owner_id: string;
  name: string;
  format: string;
  description: string | null;
  commander_scryfall_id: string | null;
  updated_at: string;
};

type DeckCardRow = {
  deck_id: string;
  quantity: number;
  board: string;
};

type ProfileRow = {
  id: string;
  nickname: string;
  avatar_url: string | null;
};

type CardRow = {
  scryfall_id: string;
  name: string;
  image_uri: string | null;
  image_uri_large: string | null;
  card_data: unknown;
};

type PublicDeck = DeckRow & {
  card_count: number;
  owner: ProfileRow | null;
  commander_name: string | null;
  commander_image: string | null;
};

type SortOption = "recent" | "name" | "cards";

function proxiedImage(url: string | null) {
  if (!url) return null;
  return `/api/scryfall/image?url=${encodeURIComponent(url)}`;
}

function relativeDate(value: string) {
  const time = new Date(value).getTime();
  const diff = Math.max(0, Date.now() - time);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "agora";
  if (diff < hour) return `há ${Math.floor(diff / minute)} min`;
  if (diff < day) return `há ${Math.floor(diff / hour)} h`;

  const days = Math.floor(diff / day);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

function getCommanderArt(card: CardRow | null) {
  if (!card) return null;

  const data =
    typeof card.card_data === "object" &&
    card.card_data !== null &&
    !Array.isArray(card.card_data)
      ? (card.card_data as Record<string, unknown>)
      : {};

  const imageUris =
    typeof data.image_uris === "object" &&
    data.image_uris !== null &&
    !Array.isArray(data.image_uris)
      ? (data.image_uris as Record<string, unknown>)
      : {};

  const artCrop =
    typeof imageUris.art_crop === "string"
      ? imageUris.art_crop
      : null;

  return (
    artCrop ??
    card.image_uri_large ??
    card.image_uri ??
    null
  );
}

export default function PublicDecksPage() {
  const [supabase] = useState(() => createClient());

  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("Todos");
  const [sort, setSort] = useState<SortOption>("recent");

  useEffect(() => {
    let cancelled = false;

    async function loadPublicDecks() {
      setErrorMessage("");

      const { data: deckRows, error: decksError } = await supabase
        .from("decks")
        .select(
          "id, owner_id, name, format, description, commander_scryfall_id, updated_at"
        )
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(60);

      if (cancelled) return;

      if (decksError) {
        console.error("Erro ao carregar decks públicos:", decksError);
        setErrorMessage("Não foi possível carregar os decks públicos.");
        setLoading(false);
        return;
      }

      const rows = (deckRows ?? []) as DeckRow[];

      if (rows.length === 0) {
        setDecks([]);
        setLoading(false);
        return;
      }

      const deckIds = rows.map((deck) => deck.id);
      const ownerIds = Array.from(new Set(rows.map((deck) => deck.owner_id)));
      const commanderIds = Array.from(
        new Set(
          rows
            .map((deck) => deck.commander_scryfall_id)
            .filter((value): value is string => Boolean(value))
        )
      );

      const [
        { data: deckCardRows, error: cardsError },
        { data: profileRows, error: profilesError },
        { data: commanderRows, error: commandersError },
      ] = await Promise.all([
        supabase
          .from("deck_cards")
          .select("deck_id, quantity, board")
          .in("deck_id", deckIds),
        supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", ownerIds),
        commanderIds.length > 0
          ? supabase
              .from("cards")
              .select(
  "scryfall_id, name, image_uri, image_uri_large, card_data"
)
              .in("scryfall_id", commanderIds)
          : Promise.resolve({
              data: [] as CardRow[],
              error: null,
            }),
      ]);

      if (cancelled) return;

      if (cardsError) {
        console.warn("Não foi possível contar cartas:", cardsError.message);
      }

      if (profilesError) {
        console.warn("Não foi possível carregar autores:", profilesError.message);
      }

      if (commandersError) {
        console.warn(
          "Não foi possível carregar comandantes:",
          commandersError.message
        );
      }

      const counts = new Map<string, number>();

      for (const row of (deckCardRows ?? []) as DeckCardRow[]) {
        if (
          row.board !== "mainboard" &&
          row.board !== "commander"
        ) {
          continue;
        }

        counts.set(
          row.deck_id,
          (counts.get(row.deck_id) ?? 0) +
            Math.max(0, Number(row.quantity) || 0)
        );
      }

      const profilesById = new Map(
        ((profileRows ?? []) as ProfileRow[]).map((profile) => [
          profile.id,
          profile,
        ])
      );

      const commandersById = new Map(
        ((commanderRows ?? []) as CardRow[]).map((card) => [
          card.scryfall_id,
          card,
        ])
      );

      setDecks(
        rows.map((deck) => {
          const commander = deck.commander_scryfall_id
            ? commandersById.get(deck.commander_scryfall_id) ?? null
            : null;

          return {
            ...deck,
            card_count: counts.get(deck.id) ?? 0,
            owner: profilesById.get(deck.owner_id) ?? null,
            commander_name: commander?.name ?? null,
            commander_image: getCommanderArt(commander),
          };
        })
      );

      setLoading(false);
    }

    void loadPublicDecks();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const formats = useMemo(
    () =>
      Array.from(new Set(decks.map((deck) => deck.format)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [decks]
  );

  const visibleDecks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");

    const result = decks.filter((deck) => {
      if (formatFilter !== "Todos" && deck.format !== formatFilter) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        deck.name,
        deck.format,
        deck.commander_name ?? "",
        deck.owner?.nickname ?? "",
        deck.description ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return haystack.includes(query);
    });

    result.sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name, "pt-BR");
      }

      if (sort === "cards") {
        return b.card_count - a.card_count;
      }

      return (
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime()
      );
    });

    return result;
  }, [decks, formatFilter, search, sort]);

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
              Comunidade
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
              Explorar decks
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/35">
              Descubra listas públicas criadas pela comunidade do CurveOut.
            </p>
          </div>

          <Link
            href="/decks/novo"
            className="rounded-xl bg-[#f4f1e8] px-5 py-3 text-sm font-semibold text-black transition hover:bg-white"
          >
            + Criar deck
          </Link>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_210px]">
          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25">
              Procurar
            </label>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Deck, comandante ou jogador..."
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-sm text-white/70 outline-none placeholder:text-white/20 focus:border-white/25"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25">
              Formato
            </label>
            <select
              value={formatFilter}
              onChange={(event) => setFormatFilter(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none"
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
            <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25">
              Ordenar
            </label>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as SortOption)
              }
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none"
            >
              <option value="recent">Atualizados recentemente</option>
              <option value="name">Nome A–Z</option>
              <option value="cards">Mais cartas</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-sm text-white/25">
            {loading
              ? "Carregando..."
              : `${visibleDecks.length} ${
                  visibleDecks.length === 1 ? "deck" : "decks"
                }`}
          </p>
        </div>

        {errorMessage && (
          <p className="mt-6 rounded-xl border border-red-300/10 bg-red-300/[0.03] px-4 py-3 text-sm text-red-100/55">
            {errorMessage}
          </p>
        )}

        {loading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-80 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.015]"
              />
            ))}
          </div>
        ) : visibleDecks.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-white/30">
            Nenhum deck público encontrado.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleDecks.map((deck) => {
              const image = proxiedImage(deck.commander_image);

              return (
                <Link
                  key={deck.id}
                  href={`/decks/${deck.id}`}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-[#101013] transition hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="relative aspect-[3/2] overflow-hidden bg-white/[0.02]">
                    {image ? (
                      <img
                        src={image}
                        alt={deck.commander_name ?? deck.name}
                        className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.025]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white/20">
                        Sem comandante
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#101013] via-transparent to-transparent" />
                  </div>

                  <div className="p-5">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/25">
                      {deck.format}
                    </p>

                    <h2 className="mt-2 truncate text-xl font-semibold text-white/80 group-hover:text-white">
                      {deck.name}
                    </h2>

                    {deck.commander_name && (
                      <p className="mt-1 truncate text-xs text-white/30">
                        {deck.commander_name}
                      </p>
                    )}

                    <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-4">
                      <div className="flex min-w-0 items-center gap-2">
                        {deck.owner?.avatar_url ? (
                          <img
                            src={deck.owner.avatar_url}
                            alt=""
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-white/[0.06]" />
                        )}

                        <span className="truncate text-xs text-white/30">
                          @{deck.owner?.nickname ?? "jogador"}
                        </span>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs text-white/40">
                          {deck.card_count} cartas
                        </p>
                        <p className="mt-0.5 text-[10px] text-white/20">
                          {relativeDate(deck.updated_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
