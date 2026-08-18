"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Profile = {
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
  favorite_card_oracle_id: string | null;
  favorite_card_printing_id: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [profile, setProfile] = useState<Profile | null>(null);
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "nickname, bio, avatar_url, favorite_card_oracle_id, favorite_card_printing_id"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      if (data) {
        setProfile(data);
        setBio(data.bio ?? "");
      }

      setLoading(false);
    }

    loadProfile();
  }, [router, supabase]);

  async function saveBio() {
    if (!profile) return;

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const newBio = bio.trim() || null;

    const { error } = await supabase
      .from("profiles")
      .update({
        bio: newBio,
      })
      .eq("id", user.id);

    if (error) {
      console.error(error);
      setMessage("Não foi possível salvar a bio.");
      setSaving(false);
      return;
    }

    setProfile({
      ...profile,
      bio: newBio,
    });

    setEditingBio(false);
    setMessage("Bio salva.");
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-white/40">
        Carregando perfil...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-white/40">
        Não foi possível carregar o perfil.
      </main>
    );
  }

  const initial = profile.nickname.charAt(0).toUpperCase();

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-6 py-10 text-[#f4f1e8] md:px-10">
      <div className="mx-auto max-w-6xl">
        {/* VOLTAR */}
        <a
          href="/"
          className="text-sm text-white/40 transition hover:text-white"
        >
          ← CurveOut
        </a>

        {/* PERFIL */}
        <section className="mt-10 border-b border-white/10 pb-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-center">
            {/* AVATAR */}
            <button
              type="button"
              className="
                flex h-28 w-28 shrink-0
                items-center justify-center
                rounded-full
                border border-white/15
                bg-white/[0.05]
                text-4xl font-semibold
                transition
                hover:border-white/30
                hover:bg-white/[0.08]
              "
              title="Foto de perfil"
            >
              {initial}
            </button>

            {/* USUÁRIO */}
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                Perfil
              </p>

              <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
                @{profile.nickname}
              </h1>

              {/* BIO */}
              {!editingBio ? (
                <div className="mt-5">
                  <p className="max-w-2xl leading-7 text-white/55">
                    {profile.bio || "Adicione uma bio ao seu perfil."}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setBio(profile.bio ?? "");
                      setEditingBio(true);
                      setMessage("");
                    }}
                    className="mt-4 text-sm text-white/40 transition hover:text-white"
                  >
                    Editar bio
                  </button>
                </div>
              ) : (
                <div className="mt-5 max-w-2xl">
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    maxLength={300}
                    rows={4}
                    placeholder="Conte um pouco sobre você..."
                    className="
                      w-full resize-none
                      rounded-xl
                      border border-white/10
                      bg-white/[0.04]
                      px-4 py-3
                      text-white
                      outline-none
                      transition
                      placeholder:text-white/25
                      focus:border-white/30
                    "
                  />

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-white/30">
                      {bio.length}/300
                    </span>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBio(profile.bio ?? "");
                          setEditingBio(false);
                        }}
                        className="rounded-lg px-4 py-2 text-sm text-white/45 transition hover:text-white"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={saveBio}
                        disabled={saving}
                        className="
                          rounded-lg
                          bg-[#f4f1e8]
                          px-4 py-2
                          text-sm font-semibold
                          text-black
                          transition
                          hover:bg-white
                          disabled:opacity-50
                        "
                      >
                        {saving ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <p className="mt-3 text-sm text-white/40">
                  {message}
                </p>
              )}
            </div>

            {/* CONFIG */}
            <a
              href="/configuracoes"
              className="
                self-start rounded-lg
                border border-white/15
                px-5 py-2.5
                text-sm text-white/60
                transition
                hover:border-white/30
                hover:text-white
              "
            >
              Editar perfil
            </a>
          </div>
        </section>

        {/* CARTA FAVORITA */}
        <section className="border-b border-white/10 py-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                Identidade
              </p>

              <h2 className="mt-2 text-3xl font-semibold">
                Carta favorita
              </h2>
            </div>

            <a
              href="/perfil/carta-favorita"
              className="
                rounded-lg
                border border-white/15
                px-5 py-2.5
                text-sm text-white/65
                transition
                hover:border-white/30
                hover:text-white
              "
            >
              + Escolher carta
            </a>
          </div>

          <div
            className="
              flex min-h-64
              items-center justify-center
              rounded-2xl
              border border-dashed border-white/10
              bg-white/[0.015]
              px-6 text-center
            "
          >
            <div>
              <div className="mx-auto mb-4 text-4xl text-white/15">
                ♠
              </div>

              <p className="text-white/45">
                Nenhuma carta favorita escolhida.
              </p>

              <p className="mt-2 text-sm text-white/25">
                Escolha uma carta para representar seu perfil.
              </p>

              <a
                href="/perfil/carta-favorita"
                className="mt-5 inline-block text-sm text-white/70 underline underline-offset-4 transition hover:text-white"
              >
                Escolher minha carta favorita
              </a>
            </div>
          </div>
        </section>

        {/* DECKS */}
        <section className="py-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                Deckbuilding
              </p>

              <h2 className="mt-2 text-3xl font-semibold">
                Decks
              </h2>
            </div>

            <a
              href="/meus-decks"
              className="text-sm text-white/40 transition hover:text-white"
            >
              Ver todos →
            </a>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-3xl font-semibold">
                0
              </p>

              <p className="mt-1 text-sm text-white/35">
                Decks públicos
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-3xl font-semibold">
                0
              </p>

              <p className="mt-1 text-sm text-white/35">
                Decks privados
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-3xl font-semibold">
                0
              </p>

              <p className="mt-1 text-sm text-white/35">
                Cartas na coleção
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}