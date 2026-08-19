"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Deck = {
  id: string;
  name: string;
  format: string;
  is_public: boolean;
  created_at: string;
};

export default function MeusDecksPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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
        .select("id, name, format, is_public, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

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
    <main className="min-h-screen bg-[#0b0b0d] px-6 py-10 text-[#f4f1e8] md:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="text-sm text-white/40 transition hover:text-white"
        >
          ← CurveOut
        </Link>

        <header className="mt-10 flex flex-col gap-6 border-b border-white/10 pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/30">
              Deckbuilding
            </p>

            <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
              Meus decks
            </h1>

            <p className="mt-4 text-sm text-white/35">
              {decks.length === 1
                ? "1 deck criado"
                : `${decks.length} decks criados`}
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
        </header>

        {errorMessage ? (
          <section className="py-12">
            <p className="text-sm text-red-300">
              {errorMessage}
            </p>
          </section>
        ) : decks.length === 0 ? (
          <section className="py-12">
            <div
              className="
                flex min-h-72
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
          </section>
        ) : (
          <section className="py-12">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck) => (
                <Link
                  key={deck.id}
                  href={`/decks/${deck.id}`}
                  className="
                    group
                    rounded-2xl
                    border border-white/10
                    bg-white/[0.02]
                    p-6
                    transition
                    hover:border-white/25
                    hover:bg-white/[0.04]
                  "
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/30">
                      {deck.format}
                    </p>

                    <span className="text-xs text-white/25">
                      {deck.is_public
                        ? "Público"
                        : "Privado"}
                    </span>
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold transition group-hover:text-white">
                    {deck.name}
                  </h2>

                  <p className="mt-8 text-sm text-white/30">
                    Abrir deck →
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}