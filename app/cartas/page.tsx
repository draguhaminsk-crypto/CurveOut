"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";

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
};

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

function parseCard(row: CardRow): CardItem {
  const data = asRecord(row.card_data);

  return {
    ...row,
    set: stringValue(data, "set", "—").toUpperCase(),
    set_name: stringValue(data, "set_name", "Edição desconhecida"),
    collector_number: stringValue(data, "collector_number", "—"),
    rarity: stringValue(data, "rarity", "unknown"),
    oracle_text: stringValue(data, "oracle_text", ""),
  };
}

function colors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string"
  );
}

function proxiedImage(url: string | null) {
  if (!url) return null;
  return `/api/scryfall/image?url=${encodeURIComponent(url)}`;
}

export default function CardsCatalogPage() {
  const [supabase] = useState(() => createClient());

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);

  const [colorFilter, setColorFilter] = useState("Todas");
  const [typeFilter, setTypeFilter] = useState("Todos");

  useEffect(() => {
    const query = search.trim();

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
        .limit(60);

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
          const aStarts = a.name.toLocaleLowerCase("pt-BR").startsWith(q);
          const bStarts = b.name.toLocaleLowerCase("pt-BR").startsWith(q);

          if (aStarts !== bStarts) return aStarts ? -1 : 1;
          return a.name.localeCompare(b.name, "pt-BR");
        });

      setResults(normalized);
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, supabase]);

  const visibleCards = useMemo(() => {
    return results.filter((card) => {
      const identity = colors(card.color_identity);

      if (colorFilter !== "Todas") {
        if (colorFilter === "C") {
          if (identity.length !== 0) return false;
        } else if (!identity.includes(colorFilter)) {
          return false;
        }
      }

      if (typeFilter !== "Todos") {
        const typeLine = (card.type_line ?? "").toLocaleLowerCase("pt-BR");

        const matches =
          typeFilter === "Criatura"
            ? typeLine.includes("creature")
            : typeFilter === "Artefato"
              ? typeLine.includes("artifact")
              : typeFilter === "Encantamento"
                ? typeLine.includes("enchantment")
                : typeFilter === "Planeswalker"
                  ? typeLine.includes("planeswalker")
                  : typeFilter === "Instantânea"
                    ? typeLine.includes("instant")
                    : typeFilter === "Feitiço"
                      ? typeLine.includes("sorcery")
                      : typeFilter === "Terreno"
                        ? typeLine.includes("land")
                        : true;

        if (!matches) return false;
      }

      return true;
    });
  }, [results, colorFilter, typeFilter]);

  function updateSearch(value: string) {
    setSearch(value);

    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setErrorMessage("");
    }
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

        <div className="mt-10">
          <p className="text-xs uppercase tracking-[0.26em] text-[#c8b27a]/55">
            Catálogo
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            Cartas
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/35">
            Pesquise o catálogo de Magic usando a base local do CurveOut.
          </p>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-[minmax(280px,1fr)_160px_190px]">
          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25">
              Procurar carta
            </label>
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Ex.: Sol Ring, Atraxa..."
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-sm text-white/70 outline-none placeholder:text-white/20 focus:border-white/25"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25">
              Cor
            </label>
            <select
              value={colorFilter}
              onChange={(event) => setColorFilter(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none"
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
            <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25">
              Tipo
            </label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-3 text-sm text-white/55 outline-none"
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

        <p className="mt-4 text-sm text-white/25">
          {loading
            ? "Procurando..."
            : search.trim().length < 2
              ? "Digite pelo menos 2 letras."
              : `${visibleCards.length} resultados`}
        </p>

        {errorMessage && (
          <p className="mt-5 rounded-xl border border-red-300/10 bg-red-300/[0.03] px-4 py-3 text-sm text-red-100/55">
            {errorMessage}
          </p>
        )}

        {search.trim().length < 2 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
            <p className="text-sm text-white/30">
              Procure pelo nome de uma carta para começar.
            </p>
          </div>
        ) : loading ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[488/680] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.015]"
              />
            ))}
          </div>
        ) : visibleCards.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center text-sm text-white/30">
            Nenhuma carta encontrada.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {visibleCards.map((card) => {
              const image = proxiedImage(
                card.image_uri_large ?? card.image_uri
              );

              return (
                <button
                  key={card.scryfall_id}
                  type="button"
                  onClick={() => setSelectedCard(card)}
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
                  <p className="mt-1 truncate text-[10px] uppercase tracking-[0.1em] text-white/20">
                    {card.set} · #{card.collector_number}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedCard && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedCard(null);
            }
          }}
        >
          <div className="relative w-full max-w-3xl rounded-2xl border border-white/12 bg-[#101013] p-5 shadow-2xl md:p-7">
            <button
              type="button"
              onClick={() => setSelectedCard(null)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-white/35 transition hover:text-white"
            >
              ×
            </button>

            <div className="grid gap-7 md:grid-cols-[240px_1fr]">
              <div className="overflow-hidden rounded-[4.6%] border border-white/10 bg-[#111114]">
                <div className="aspect-[488/680]">
                  {proxiedImage(
                    selectedCard.image_uri_large ??
                      selectedCard.image_uri
                  ) ? (
                    <img
                      src={
                        proxiedImage(
                          selectedCard.image_uri_large ??
                            selectedCard.image_uri
                        )!
                      }
                      alt={selectedCard.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-5 text-center text-sm text-white/30">
                      {selectedCard.name}
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 self-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#c8b27a]/50">
                  {selectedCard.set_name}
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  {selectedCard.name}
                </h2>
                <p className="mt-3 text-sm text-white/35">
                  {selectedCard.type_line || "Tipo não informado"}
                </p>

                {selectedCard.oracle_text && (
                  <p className="mt-6 whitespace-pre-line text-sm leading-6 text-white/50">
                    {selectedCard.oracle_text}
                  </p>
                )}

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
      )}
    </main>
  );
}
