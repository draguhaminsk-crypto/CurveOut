"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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

export default function NovoDeckPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [name, setName] = useState("");
  const [format, setFormat] = useState("Commander");
  const [isPublic, setIsPublic] = useState(true);

  const [checkingUser, setCheckingUser] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      setCheckingUser(false);
    }

    checkUser();
  }, [router, supabase]);

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

    const { data, error } = await supabase
      .from("decks")
      .insert({
        owner_id: user.id,
        name: cleanName,
        format,
        is_public: isPublic,
      })
      .select("id")
      .single();

    if (error) {
  console.error("Erro ao criar deck:", error);
  setErrorMessage(`Erro: ${error.message}`);
  setCreating(false);
  return;
}

    router.push(`/decks/${data.id}`);
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
            Dê um nome ao seu deck e escolha o formato. Depois você poderá
            adicionar as cartas.
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
              placeholder="Ex: Sauron Reanimator"
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
                placeholder:text-white/20
                focus:border-white/30
              "
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
              onChange={(event) => setFormat(event.target.value)}
              className="
                mt-3
                w-full
                rounded-xl
                border border-white/10
                bg-[#111114]
                px-4 py-3.5
                text-[#f4f1e8]
                outline-none
                transition
                focus:border-white/30
              "
            >
              {formats.map((deckFormat) => (
                <option key={deckFormat} value={deckFormat}>
                  {deckFormat}
                </option>
              ))}
            </select>
          </div>

          {/* VISIBILIDADE */}
          <div className="mt-8">
            <p className="text-sm font-medium text-white/70">Visibilidade</p>

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
            <p className="mt-6 text-sm text-red-300">{errorMessage}</p>
          )}

          {/* AÇÕES */}
          <div className="mt-10 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-8">
            <a
              href="/meus-decks"
              className="
                rounded-lg
                px-5 py-2.5
                text-sm text-white/45
                transition
                hover:text-white
              "
            >
              Cancelar
            </a>

            <button
              type="submit"
              disabled={creating || !name.trim()}
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
              {creating ? "Criando..." : "Criar deck"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}