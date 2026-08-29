"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type DeckCoverMode = "art" | "full-card";

export type DeckCardData = {
  id: string;
  name: string;
  format: string;
  is_public: boolean;
  is_favorite: boolean;
  description: string | null;
  tags: string[];
  commander_scryfall_id: string | null;
  commander_name: string | null;
  commander_image: string | null;
  commander_image_mode: DeckCoverMode;
  color_name: string;
  card_count: number;
  average_mv: number;
  price_usd: number | null;
  is_legal: boolean | null;
  problem_count: number;
  problems: string[];
  collection_id: string | null;
  collection_name: string | null;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
};

type DeckCardProps = {
  deck: DeckCardData;
  onToggleFavorite: (deck: DeckCardData) => void;
  onToggleVisibility: (deck: DeckCardData) => void;
  onRename: (deck: DeckCardData) => void;
  onDelete: (deck: DeckCardData) => void;
  onOpen?: (deck: DeckCardData) => void;
  onMoveCollection?: (deck: DeckCardData, collectionId: string | null) => void;
  onToggleSelected?: (deck: DeckCardData) => void;
  collections?: Array<{ id: string; name: string }>;
  selectionMode?: boolean;
  selected?: boolean;
  index?: number;
  animationKey?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRelativeDate(value: string) {
  const timestamp = new Date(value).getTime();
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "agora";
  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute);
    return `há ${minutes} min`;
  }

  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `há ${hours} h`;
  }

  if (diffMs < 30 * day) {
    const days = Math.floor(diffMs / day);
    return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function truncateText(text: string, maxLength = 110) {
  const cleanText = text.trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  return `${cleanText.slice(0, maxLength).trimEnd()}...`;
}

function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function DeckCard({
  deck,
  onToggleFavorite,
  onToggleVisibility,
  onRename,
  onDelete,
  onOpen,
  onMoveCollection,
  onToggleSelected,
  collections = [],
  selectionMode = false,
  selected = false,
  index = 0,
  animationKey = "",
}: DeckCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = cardRef.current;
    if (!element) return;

    const animation = element.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: 220,
        delay: Math.min(index, 8) * 35,
        easing: "ease-out",
        fill: "both",
      }
    );

    return () => {
      animation.cancel();
    };
  }, [animationKey, index]);

  useEffect(() => {
    if (!menuOpen) return;

    function closeMenu(event: MouseEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const priceText = formatUsd(deck.price_usd);

  return (
    <article
      ref={cardRef}
      className={`
        group relative overflow-hidden rounded-2xl
        border bg-white/[0.02]
        transition-all duration-200 ease-out
        hover:-translate-y-0.5 hover:bg-white/[0.035]
        ${
          selected
            ? "border-white/40 ring-1 ring-white/20"
            : "border-white/10 hover:border-white/25"
        }
      `}
    >
      {selectionMode && (
        <button
          type="button"
          onClick={() => onToggleSelected?.(deck)}
          aria-label={selected ? "Remover deck da seleção" : "Selecionar deck"}
          className={`
            absolute left-3 top-3 z-30
            flex h-8 w-8 items-center justify-center
            rounded-lg border text-sm font-semibold
            shadow-lg shadow-black/30 backdrop-blur-md transition
            ${
              selected
                ? "border-white/35 bg-[#f4f1e8] text-black"
                : "border-white/20 bg-black/65 text-white/55 hover:border-white/35 hover:text-white"
            }
          `}
        >
          {selected ? "✓" : ""}
        </button>
      )}
      <Link
        href={`/decks/${deck.id}`}
        aria-label={`Abrir deck ${deck.name}`}
        className="block"
        onClick={(event) => {
          if (selectionMode) {
            event.preventDefault();
            onToggleSelected?.(deck);
            return;
          }

          onOpen?.(deck);
        }}
      >
        <div className="relative h-36 overflow-hidden border-b border-white/10 bg-[#111114]">
          <div
            className="absolute inset-0 bg-no-repeat"
            style={{
              backgroundImage: deck.commander_image
                ? `url("${deck.commander_image}")`
                : "url('/hero-bg.jpg')",
              backgroundSize:
                deck.commander_image_mode === "full-card"
                  ? "100% auto"
                  : "cover",
              // Quando só temos a imagem completa da carta, deslocamos a carta
              // para cima e mostramos exclusivamente a janela da ilustração.
              // Assim moldura, nome, mana e linha de tipo ficam fora da capa.
              backgroundPosition:
                deck.commander_image_mode === "full-card"
                  ? "center -48px"
                  : "center 42%",
              opacity: deck.commander_image ? 1 : 0.32,
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d]/35 via-transparent to-black/10" />
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">
              {deck.format}
            </p>

            <Link
              href={`/decks/${deck.id}`}
              className="mt-2 block"
              onClick={(event) => {
                if (selectionMode) {
                  event.preventDefault();
                  onToggleSelected?.(deck);
                  return;
                }

                onOpen?.(deck);
              }}
            >
              <h2 className="line-clamp-2 text-xl font-semibold leading-tight text-[#f4f1e8] transition group-hover:text-white">
                {deck.name}
              </h2>
            </Link>

            {deck.commander_name && (
              <p className="mt-1 truncate text-xs text-white/30">
                {deck.commander_name}
              </p>
            )}

            {deck.collection_name && (
              <p className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-white/20">
                Pasta · {deck.collection_name}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleFavorite(deck)}
              title={deck.is_favorite ? "Remover dos favoritos" : "Favoritar deck"}
              aria-label={deck.is_favorite ? "Remover dos favoritos" : "Favoritar deck"}
              className={`
                flex h-8 w-8 items-center justify-center rounded-lg
                border transition
                ${
                  deck.is_favorite
                    ? "border-amber-200/20 bg-amber-200/[0.055] text-amber-100/75"
                    : "border-white/[0.07] text-white/20 hover:border-white/20 hover:text-white/60"
                }
              `}
            >
              {deck.is_favorite ? "★" : "☆"}
            </button>

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                aria-label="Mais ações"
                className="
                  flex h-8 w-8 items-center justify-center rounded-lg
                  border border-white/[0.07]
                  text-lg leading-none text-white/25
                  transition hover:border-white/20 hover:text-white/70
                "
              >
                ⋯
              </button>

              {menuOpen && (
                <div
                  className="
                    absolute right-0 top-10 z-40 w-44 overflow-hidden
                    rounded-xl border border-white/10
                    bg-[#111114]/98 p-1.5
                    shadow-2xl shadow-black/50
                    backdrop-blur-xl
                  "
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onRename(deck);
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-xs text-white/50 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    Editar nome
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleVisibility(deck);
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-xs text-white/50 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    Tornar {deck.is_public ? "privado" : "público"}
                  </button>

                  <div className="my-1 border-t border-white/[0.07]" />

                  <div className="px-2 py-1.5">
                    <p className="mb-1.5 text-[9px] uppercase tracking-[0.14em] text-white/20">
                      Pasta
                    </p>

                    <select
                      value={deck.collection_id ?? ""}
                      onChange={(event) => {
                        onMoveCollection?.(
                          deck,
                          event.target.value || null
                        );
                      }}
                      className="w-full rounded-lg border border-white/10 bg-[#0b0b0d] px-2 py-2 text-[11px] text-white/55 outline-none"
                    >
                      <option value="">Sem pasta</option>
                      {collections.map((collection) => (
                        <option key={collection.id} value={collection.id}>
                          {collection.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="my-1 border-t border-white/[0.07]" />

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(deck);
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-100/45 transition hover:bg-red-300/[0.055] hover:text-red-100/75"
                  >
                    Excluir deck
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded-full border border-white/[0.07] bg-black/15 px-2 py-1 text-white/35">
            {deck.color_name}
          </span>

          <span className="rounded-full border border-white/[0.07] bg-black/15 px-2 py-1 text-white/35">
            {deck.card_count} cartas
          </span>

          <span className="rounded-full border border-white/[0.07] bg-black/15 px-2 py-1 text-white/35">
            MV {deck.average_mv.toFixed(2)}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
          {priceText && (
            <span className="rounded-full border border-white/[0.07] bg-black/15 px-2 py-1 text-white/35">
              {priceText}
            </span>
          )}

          {deck.is_legal !== null &&
            (deck.is_legal ? (
              <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.045] px-2 py-1 text-emerald-100/55">
                Legal ✓
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setProblemsOpen((current) => !current)}
                aria-expanded={problemsOpen}
                title="Ver problemas do deck"
                className="
                  rounded-full border border-amber-300/15
                  bg-amber-300/[0.045] px-2 py-1
                  text-amber-100/55 transition
                  hover:border-amber-200/30 hover:bg-amber-200/[0.08]
                  hover:text-amber-50
                "
              >
                {deck.problem_count} problema{deck.problem_count === 1 ? "" : "s"}{" "}
                <span className="ml-0.5 text-[9px]">
                  {problemsOpen ? "▲" : "▼"}
                </span>
              </button>
            ))}

          <span
            className={`
              rounded-full border px-2 py-1
              ${
                deck.is_public
                  ? "border-emerald-300/15 bg-emerald-300/[0.035] text-emerald-100/45"
                  : "border-amber-300/15 bg-amber-300/[0.035] text-amber-100/45"
              }
            `}
          >
            {deck.is_public ? "Público" : "Privado"}
          </span>
        </div>

        {problemsOpen && deck.problems.length > 0 && (
          <div className="mt-2 rounded-xl border border-amber-300/10 bg-amber-300/[0.035] px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-[0.16em] text-amber-100/35">
              Problemas encontrados
            </p>

            <div className="mt-2 space-y-1.5">
              {deck.problems.map((problem) => (
                <p
                  key={problem}
                  className="flex gap-2 text-[11px] leading-4 text-amber-50/55"
                >
                  <span className="mt-[1px] text-amber-200/45">•</span>
                  <span>{problem}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {deck.format.toLocaleLowerCase("pt-BR") === "commander" && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]">
              <span className="text-white/25">Progresso do deck</span>
              <span
                className={
                  deck.card_count === 100
                    ? "text-emerald-100/55"
                    : deck.card_count > 100
                      ? "text-amber-100/55"
                      : "text-white/35"
                }
              >
                {deck.card_count}/100
              </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`
                  h-full rounded-full transition-[width] duration-300
                  ${
                    deck.card_count === 100 && deck.problem_count === 0
                      ? "bg-emerald-200/45"
                      : deck.card_count > 100 || deck.problem_count > 0
                        ? "bg-amber-200/40"
                        : "bg-white/30"
                  }
                `}
                style={{
                  width: `${Math.min(100, Math.max(0, deck.card_count))}%`,
                }}
              />
            </div>
          </div>
        )}

        {deck.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {deck.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-white/[0.035] px-2 py-1 text-[10px] text-white/30"
              >
                #{tag}
              </span>
            ))}

            {deck.tags.length > 2 && (
              <span className="rounded-md bg-white/[0.025] px-2 py-1 text-[10px] text-white/20">
                +{deck.tags.length - 2}
              </span>
            )}
          </div>
        )}

        <p className="mt-3 min-h-10 text-xs leading-5 text-white/30">
          {deck.description
            ? truncateText(deck.description)
            : "Sem notas adicionadas."}
        </p>

        <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-3">
          <p
            title={formatDate(deck.updated_at)}
            className="text-[10px] text-white/25"
          >
            Atualizado {formatRelativeDate(deck.updated_at)}
          </p>

          <Link
            href={`/decks/${deck.id}`}
            className="text-xs text-white/30 transition hover:text-white/70"
            onClick={(event) => {
              if (selectionMode) {
                event.preventDefault();
                onToggleSelected?.(deck);
                return;
              }

              onOpen?.(deck);
            }}
          >
            Abrir deck →
          </Link>
        </div>
      </div>
    </article>
  );
}
