"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type ScryfallCard = {
  id: string;
  oracle_id?: string;

  name: string;
  printed_name?: string;

  set: string;
  set_name: string;

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

function getCardImage(card: ScryfallCard) {
  return (
    card.image_uris?.large ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.large ??
    card.card_faces?.[0]?.image_uris?.normal
  );
}

export default function FavoriteCardPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [search, setSearch] = useState("");
  const [cards, setCards] = useState<ScryfallCard[]>([]);

  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();

    const query = search.trim();

    if (!query) return;

    setLoading(true);
    setMessage("");
    setCards([]);

    try {
      const response = await fetch(
  `/api/cards/search?q=${encodeURIComponent(query)}`
);
      if (!response.ok) {
  const errorData = await response.json();

  setMessage(
    errorData.error ?? "Não foi possível buscar as cartas."
  );

  setLoading(false);
  return;
}

      const result = await response.json();

      setCards(result.data?.slice(0, 24) ?? []);
    } catch {
      setMessage("Não foi possível buscar as cartas.");
    }

    setLoading(false);
  }

  async function chooseCard(card: ScryfallCard) {
    if (!card.oracle_id) {
      setMessage("Não foi possível identificar essa carta.");
      return;
    }

    setSavingId(card.id);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        favorite_card_oracle_id: card.oracle_id,
        favorite_card_printing_id: card.id,
      })
      .eq("id", user.id);

    if (error) {
      console.error(error);
      setMessage("Não foi possível salvar sua carta favorita.");
      setSavingId(null);
      return;
    }

    router.push("/perfil");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-6 py-10 text-[#f4f1e8] md:px-10">
      <div className="mx-auto max-w-7xl">
        <a
          href="/perfil"
          className="text-sm text-white/40 transition hover:text-white"
        >
          ← Voltar para o perfil
        </a>

        <div className="mt-12">
          <p className="text-xs uppercase tracking-[0.2em] text-white/30">
            Perfil
          </p>

          <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
            Escolha sua carta favorita
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-white/45">
            Procure uma carta e escolha a impressão que você quer exibir no seu
            perfil.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="mt-10 flex max-w-3xl gap-3"
        >
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ex.: Lightning Bolt, Atraxa, Sol Ring..."
            className="
              min-w-0 flex-1
              rounded-xl
              border border-white/10
              bg-white/[0.04]
              px-5 py-3
              text-white
              outline-none
              placeholder:text-white/25
              transition
              focus:border-white/30
            "
          />

          <button
            type="submit"
            disabled={loading}
            className="
              rounded-xl
              bg-[#f4f1e8]
              px-6 py-3
              font-semibold
              text-black
              transition
              hover:bg-white
              disabled:opacity-50
            "
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {message && (
          <p className="mt-6 text-sm text-white/45">
            {message}
          </p>
        )}

        {cards.length > 0 && (
          <section className="mt-12">
            <div className="mb-6">
              <p className="text-sm text-white/35">
                Clique na versão que você quer usar.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {cards.map((card) => {
                const image = getCardImage(card);

                if (!image) return null;

                const cardName =
                  card.printed_name ?? card.name;

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => chooseCard(card)}
                    disabled={savingId !== null}
                    className="
                      group
                      text-left
                      transition
                      disabled:opacity-50
                    "
                  >
                    <div
                      className="
                        overflow-hidden
                        rounded-xl
                        border border-transparent
                        transition
                        group-hover:-translate-y-1
                        group-hover:border-white/25
                      "
                    >
                      <img
                        src={image}
                        alt={cardName}
                        className="w-full"
                      />
                    </div>

                    <p className="mt-3 truncate text-sm font-medium text-white/75">
                      {cardName}
                    </p>

                    <p className="mt-1 truncate text-xs text-white/30">
                      {card.set_name}
                    </p>

                    {savingId === card.id && (
                      <p className="mt-2 text-xs text-white/50">
                        Salvando...
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}