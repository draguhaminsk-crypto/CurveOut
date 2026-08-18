"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
        console.error("Erro ao carregar perfil:", error);
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
      setSaving(false);
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
      console.error("Erro ao salvar bio:", error);

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

  async function handleAvatarChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage("");

    if (!file.type.startsWith("image/")) {
      setMessage("Escolha um arquivo de imagem.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("A imagem deve ter no máximo 2 MB.");
      event.target.value = "";
      return;
    }

    setUploadingAvatar(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUploadingAvatar(false);
      router.replace("/auth/login");
      return;
    }

    /*
      O arquivo fica assim no Storage:

      avatars
        └── ID_DO_USUARIO
              └── avatar
    */
    const filePath = `${user.id}/avatar`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("Erro no upload do avatar:", uploadError);

      setMessage("Não foi possível enviar a foto.");
      setUploadingAvatar(false);
      event.target.value = "";

      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    /*
      O ?v=... evita que o navegador continue mostrando
      a imagem antiga depois que o usuário trocar a foto.
    */
    const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        avatar_url: avatarUrl,
      })
      .eq("id", user.id);

    if (profileError) {
      console.error(
        "Erro ao salvar avatar no perfil:",
        profileError
      );

      setMessage(
        "A foto foi enviada, mas não foi possível salvar no perfil."
      );

      setUploadingAvatar(false);
      event.target.value = "";

      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            avatar_url: avatarUrl,
          }
        : current
    );

    setMessage("Foto de perfil atualizada.");
    setUploadingAvatar(false);

    event.target.value = "";
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

        {/* CABEÇALHO DO PERFIL */}
        <section className="mt-10 border-b border-white/10 pb-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-center">

            {/* AVATAR */}
            <div className="relative h-28 w-28 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Alterar foto de perfil"
                className="
                  group
                  relative
                  flex h-28 w-28
                  items-center justify-center
                  overflow-hidden
                  rounded-full
                  border border-white/15
                  bg-white/[0.05]
                  text-4xl font-semibold
                  transition
                  hover:border-white/35
                  disabled:cursor-wait
                  disabled:opacity-60
                "
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                   alt={`Foto de @${profile.nickname}`}
                  className="h-full w-full object-cover object-center"
                 />
) : (
  <span>{initial}</span>
)}

                <div
                  className="
                    absolute inset-0
                    flex items-center justify-center
                    bg-black/65
                    px-2
                    text-center
                    text-xs font-medium
                    opacity-0
                    transition
                    group-hover:opacity-100
                  "
                >
                  {uploadingAvatar
                    ? "Enviando..."
                    : "Alterar foto"}
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* INFORMAÇÕES */}
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
                  <p className="max-w-2xl whitespace-pre-line leading-7 text-white/55">
                    {profile.bio ||
                      "Adicione uma bio ao seu perfil."}
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
                    onChange={(event) =>
                      setBio(event.target.value)
                    }
                    maxLength={300}
                    rows={4}
                    placeholder="Conte um pouco sobre você..."
                    className="
                      w-full
                      resize-none
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
                          setMessage("");
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
                        {saving
                          ? "Salvando..."
                          : "Salvar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <p className="mt-4 text-sm text-white/45">
                  {message}
                </p>
              )}
            </div>

            {/* CONFIGURAÇÕES */}
            <a
              href="/configuracoes"
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
              {profile.favorite_card_printing_id
                ? "Trocar carta"
                : "+ Escolher carta"}
            </a>
          </div>

          {profile.favorite_card_printing_id ? (
            <div
              className="
                flex min-h-64
                items-center justify-center
                rounded-2xl
                border border-white/10
                bg-white/[0.02]
                px-6 text-center
              "
            >
              <div>
                <p className="text-white/55">
                  Carta favorita salva.
                </p>

                <p className="mt-2 text-sm text-white/30">
                  A imagem será carregada pelo Scryfall quando
                  estivermos em uma rede sem o bloqueio.
                </p>

                <a
                  href="/perfil/carta-favorita"
                  className="mt-5 inline-block text-sm text-white/70 underline underline-offset-4 transition hover:text-white"
                >
                  Trocar carta favorita
                </a>
              </div>
            </div>
          ) : (
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
          )}
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