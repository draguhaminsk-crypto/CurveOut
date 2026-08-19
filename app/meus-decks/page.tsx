"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import DeckCard, {
  type DeckCardData,
} from "../components/DeckCard";
import { createClient } from "../../lib/supabase/client";

type VisibilityFilter = "all" | "public" | "private";
type SortOption = "recent" | "name" | "format";


type SortDropdownProps = {
  value: SortOption;
  onChange: (value: SortOption) => void;
};

const sortLabels: Record<SortOption, string> = {
  recent: "Atualizados recentemente",
  name: "Nome",
  format: "Formato",
};

function SortDropdown({
  value,
  onChange,
}: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
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
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="
          flex w-full items-center justify-between
          rounded-xl
          border border-white/10
          bg-[#0f0f12]
          px-4 py-3
          text-left text-sm text-white/70
          outline-none
          transition
          hover:border-white/20
          focus:border-white/30
        "
      >
        <span>{sortLabels[value]}</span>

        <span
          className={`
            text-[10px] text-white/35
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
            absolute left-0 right-0 top-full z-40
            mt-2
            overflow-hidden
            rounded-xl
            border border-white/10
            bg-[#111114]/95
            p-1.5
            shadow-2xl
            backdrop-blur-xl
          "
        >
          {(Object.keys(sortLabels) as SortOption[]).map(
            (option) => (
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
                {sortLabels[option]}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function MeusDecksPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [decks, setDecks] = useState<DeckCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [visibility, setVisibility] =
    useState<VisibilityFilter>("all");
  const [sortBy, setSortBy] =
    useState<SortOption>("recent");

  useEffect(() => {
    async function loadDecks() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data, error } = await supabase
        .from("decks")
        .select(
          "id, name, format, is_public, description, commander_scryfall_id, created_at, updated_at"
        )
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar decks:", error);
        setErrorMessage("Não foi possível carregar seus decks.");
        setLoading(false);
        return;
      }

      setDecks(data ?? []);
      setLoading(false);
    }

    loadDecks();
  }, [router, supabase]);

  const publicCount = decks.filter(
    (deck) => deck.is_public
  ).length;

  const privateCount = decks.length - publicCount;

  const visibleDecks = useMemo(() => {
    const cleanSearch = search.trim().toLocaleLowerCase("pt-BR");

    const filtered = decks.filter((deck) => {
      const matchesSearch =
        !cleanSearch ||
        deck.name.toLocaleLowerCase("pt-BR").includes(cleanSearch) ||
        deck.format.toLocaleLowerCase("pt-BR").includes(cleanSearch);

      const matchesVisibility =
        visibility === "all" ||
        (visibility === "public" && deck.is_public) ||
        (visibility === "private" && !deck.is_public);

      return matchesSearch && matchesVisibility;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, "pt-BR");
      }

      if (sortBy === "format") {
        const formatCompare = a.format.localeCompare(
          b.format,
          "pt-BR"
        );

        if (formatCompare !== 0) {
          return formatCompare;
        }

        return a.name.localeCompare(b.name, "pt-BR");
      }

      return (
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime()
      );
    });
  }, [decks, search, visibility, sortBy]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-[#f4f1e8]">
        <p className="text-sm text-white/40">
          Carregando seus decks...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-4 py-8 text-[#f4f1e8] md:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <Link
          href="/"
          className="text-sm text-white/40 transition hover:text-white"
        >
          ← CurveOut
        </Link>

        <header className="mt-10 border-b border-white/10 pb-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/30">
                Deckbuilding
              </p>

              <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
                Meus decks
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/35">
                Encontre, organize e continue trabalhando nos seus decks.
              </p>
            </div>

            <Link
              href="/decks/novo"
              className="
                self-start
                rounded-lg
                bg-[#f4f1e8]
                px-6 py-2.5
                text-sm font-semibold
                text-black
                transition
                hover:bg-white
              "
            >
              Criar deck
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
            <button
              type="button"
              onClick={() => setVisibility("all")}
              className={`
                rounded-xl
                border p-4
                text-left
                transition
                ${
                  visibility === "all"
                    ? "border-white/25 bg-white/[0.06]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }
              `}
            >
              <p className="text-2xl font-semibold">{decks.length}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/30">
                Todos
              </p>
            </button>

            <button
              type="button"
              onClick={() => setVisibility("public")}
              className={`
                rounded-xl
                border p-4
                text-left
                transition
                ${
                  visibility === "public"
                    ? "border-white/25 bg-white/[0.06]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }
              `}
            >
              <p className="text-2xl font-semibold">{publicCount}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/30">
                Públicos
              </p>
            </button>

            <button
              type="button"
              onClick={() => setVisibility("private")}
              className={`
                rounded-xl
                border p-4
                text-left
                transition
                ${
                  visibility === "private"
                    ? "border-white/25 bg-white/[0.06]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }
              `}
            >
              <p className="text-2xl font-semibold">{privateCount}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/30">
                Privados
              </p>
            </button>
          </div>
        </header>

        <section className="py-8">
          <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
            <div>
              <label
                htmlFor="deck-search"
                className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-white/25"
              >
                Procurar deck
              </label>

              <input
                id="deck-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar por nome ou formato..."
                className="
                  w-full
                  rounded-xl
                  border border-white/10
                  bg-[#0f0f12]
                  px-4 py-3
                  text-sm text-white
                  outline-none
                  transition
                  placeholder:text-white/20
                  focus:border-white/30
                "
              />
            </div>

            <div>
              <label
                className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-white/25"
              >
                Ordenar
              </label>

              <SortDropdown
                value={sortBy}
                onChange={setSortBy}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-sm text-white/30">
              {visibleDecks.length === 1
                ? "1 deck encontrado"
                : `${visibleDecks.length} decks encontrados`}
            </p>

            {(search || visibility !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setVisibility("all");
                }}
                className="text-sm text-white/35 transition hover:text-white"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {errorMessage ? (
            <div className="mt-8 rounded-xl border border-red-300/10 bg-red-300/[0.03] p-5">
              <p className="text-sm text-red-200/70">
                {errorMessage}
              </p>
            </div>
          ) : decks.length === 0 ? (
            <div
              className="
                mt-8
                flex min-h-80
                items-center justify-center
                rounded-2xl
                border border-dashed border-white/10
                bg-white/[0.015]
                px-6
                text-center
              "
            >
              <div>
                <p className="text-lg text-white/55">
                  Você ainda não criou nenhum deck.
                </p>

                <p className="mt-2 text-sm text-white/30">
                  Crie seu primeiro deck para começar.
                </p>

                <Link
                  href="/decks/novo"
                  className="
                    mt-6
                    inline-block
                    rounded-lg
                    bg-[#f4f1e8]
                    px-6 py-2.5
                    text-sm font-semibold
                    text-black
                    transition
                    hover:bg-white
                  "
                >
                  Criar deck
                </Link>
              </div>
            </div>
          ) : visibleDecks.length === 0 ? (
            <div
              className="
                mt-8
                flex min-h-64
                items-center justify-center
                rounded-2xl
                border border-dashed border-white/10
                bg-white/[0.015]
                px-6
                text-center
              "
            >
              <div>
                <p className="text-white/50">
                  Nenhum deck corresponde aos filtros.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setVisibility("all");
                  }}
                  className="mt-4 text-sm text-white/40 underline underline-offset-4 transition hover:text-white"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleDecks.map((deck) => (
                <DeckCard key={deck.id} deck={deck} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}