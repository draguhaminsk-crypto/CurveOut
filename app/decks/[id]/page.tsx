"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

export default function DeckPage() {
  const params = useParams<{ id: string }>();
  const [supabase] = useState(() => createClient());

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadDeck() {
      setLoading(true);
      setErrorMessage("");

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
      setLoading(false);
    }

    if (params.id) {
      loadDeck();
    }
  }, [params.id, supabase]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-[#f4f1e8]">
        <p className="text-sm text-white/40">
          Carregando deck...
        </p>
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
    <main className="min-h-screen bg-[#0b0b0d] px-6 py-10 text-[#f4f1e8] md:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/meus-decks"
          className="text-sm text-white/40 transition hover:text-white"
        >
          ← Meus decks
        </Link>

        <header className="mt-10 border-b border-white/10 pb-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/30">
                {deck.format}
              </p>

              <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
                {deck.name}
              </h1>

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/35">
                <span>
                  {deck.is_public ? "Público" : "Privado"}
                </span>

                <span>•</span>

                <span>0 cartas</span>
              </div>
            </div>

            <button
              type="button"
              className="
                self-start
                rounded-lg
                border border-white/15
                px-5 py-2.5
                text-sm text-white/60
                transition
                hover:border-white/30
                hover:text-white
              "
            >
              Editar deck
            </button>
          </div>
        </header>

        <section className="py-12">
          <div
            className="
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
                Seu deck está vazio.
              </p>

              <p className="mt-2 text-sm text-white/30">
                Adicione cartas para começar a montar o deck.
              </p>

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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}