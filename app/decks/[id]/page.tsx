"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Deck = {
  id: string;
  owner_id: string;
  name: string;
  format: string;
  is_public: boolean;
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

  const [cardSearch, setCardSearch] = useState("");
  const [deckSearch, setDeckSearch] = useState("");
  const [organizeBy, setOrganizeBy] = useState("Tipo");
  const [viewMode, setViewMode] = useState("Stack");

  const [deckArt, setDeckArt] = useState("/hero-bg.jpg");

  const [updateDeckOpen, setUpdateDeckOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const priceMenuRef = useRef<HTMLDivElement | null>(null);

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
          "id, owner_id, name, format, is_public, commander_scryfall_id, created_at, updated_at"
        )
        .eq("id", params.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar deck:", error);
        setErrorMessage(error.message);
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

      setIsOwner(Boolean(user && user.id === data.owner_id));

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

  function startEditing() {
    if (!deck) return;

    setName(deck.name);
    setFormat(deck.format);
    setIsPublic(deck.is_public);
    setErrorMessage("");
    setEditing(true);
  }

  function cancelEditing() {
    if (!deck) return;

    setName(deck.name);
    setFormat(deck.format);
    setIsPublic(deck.is_public);
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

    const { error } = await supabase
      .from("decks")
      .update({
        name: cleanName,
        format,
        is_public: isPublic,
        updated_at: new Date().toISOString(),
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
      updated_at: new Date().toISOString(),
    });

    setEditing(false);
    setSaving(false);
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
      <div className="w-full">
        <Link
          href="/meus-decks"
          className="text-sm text-white/40 transition hover:text-white"
        >
          ← Meus decks
        </Link>

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

                  <span>•</span>

                  <span>0 cartas</span>

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

                {isOwner && (
                  <div className="mt-5 flex flex-wrap gap-2">
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

                    <button
                      type="button"
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
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl">
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

              {errorMessage && (
                <p className="mt-6 text-sm text-red-300">
                  {errorMessage}
                </p>
              )}

              <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-7">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="
                    rounded-lg
                    px-5 py-2.5
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
              <div className="grid gap-3 border-b border-white/10 p-3 xl:grid-cols-[1.5fr_0.75fr_0.75fr_1.25fr]">
                {/* PROCURAR / ADICIONAR CARTA */}
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
                      onChange={(event) => setCardSearch(event.target.value)}
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

                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/25">
                      ⌕
                    </span>
                  </div>
                </div>

                {/* ORGANIZAR POR */}
                <div>
                  <label
                    className="mb-2 block px-1 text-[11px] uppercase tracking-[0.16em] text-white/25"
                  >
                    Organizar por
                  </label>

                  <CurveOutSelect
                    value={organizeBy}
                    onChange={setOrganizeBy}
                    options={[
                      "Cor",
                      "Identidade de cor",
                      "Tipo",
                      "Categoria",
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

              {/* ÁREA DAS CARTAS */}
              <div className="min-h-[420px] px-5 py-10 md:px-6 lg:px-8">
                <div className="max-w-xl">
                  <p className="text-lg text-white/55">
                    Seu deck está vazio.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-white/30">
                    Adicione cartas para começar a montar o deck.
                  </p>

                  {isOwner && (
                    <button
                      type="button"
                      className="
                        mt-6
                        rounded-lg
                        bg-[#f4f1e8]
                        px-6 py-2.5
                        text-sm font-semibold
                        text-black
                        transition
                        hover:bg-white
                      "
                    >
                      Adicionar cartas
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {updateDeckOpen && (
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