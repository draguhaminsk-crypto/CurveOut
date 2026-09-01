"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Profile = {
  id: string;
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
  favorite_card_oracle_id: string | null;
  favorite_card_printing_id: string | null;
  created_at: string | null;
};

type SocialProfile = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
};

type SocialModalMode = "followers" | "following";

type ScryfallImageUris = {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
};

type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  scryfall_uri?: string;
  image_uris?: ScryfallImageUris;
  card_faces?: Array<{
    name: string;
    image_uris?: ScryfallImageUris;
  }>;
};

type ProfileDeck = {
  id: string;
  name: string;
  format: string;
  is_public: boolean;
  commander_scryfall_id: string | null;
  updated_at: string;
};

type ProfileDeckCardRow = {
  deck_id: string;
  scryfall_id: string;
  oracle_id: string | null;
  quantity: number;
  board: string;
};

type ProfileColorCardRow = {
  scryfall_id: string;
  color_identity: unknown;
};

type ProfileDeckSummary = ProfileDeck & {
  card_count: number;
};


type ManaColor = "W" | "U" | "B" | "R" | "G";

type ColorStat = {
  color: ManaColor;
  count: number;
};

const manaColorMeta: Record<
  ManaColor,
  { label: string; className: string }
> = {
  W: {
    label: "Branco",
    className: "border-[#f5e7b8]/25 bg-[#f5e7b8]/10 text-[#f7edcf]/80",
  },
  U: {
    label: "Azul",
    className: "border-sky-300/20 bg-sky-300/[0.07] text-sky-100/75",
  },
  B: {
    label: "Preto",
    className: "border-violet-300/15 bg-violet-300/[0.06] text-violet-100/65",
  },
  R: {
    label: "Vermelho",
    className: "border-red-300/20 bg-red-300/[0.07] text-red-100/70",
  },
  G: {
    label: "Verde",
    className: "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100/70",
  },
};

function normalizeColorIdentity(value: unknown): ManaColor[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (color): color is ManaColor =>
      typeof color === "string" &&
      ["W", "U", "B", "R", "G"].includes(color)
  );
}

function formatCurveOutSince(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

export default function ProfilePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [socialModal, setSocialModal] =
    useState<SocialModalMode | null>(null);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState("");

  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [message, setMessage] = useState("");

  const [favoriteCard, setFavoriteCard] =
    useState<ScryfallCard | null>(null);
  const [loadingFavoriteCard, setLoadingFavoriteCard] =
    useState(false);
  const [favoriteCardError, setFavoriteCardError] =
    useState("");

  const [profileDecks, setProfileDecks] = useState<ProfileDeckSummary[]>([]);
  const [publicDeckCount, setPublicDeckCount] = useState(0);
  const [privateDeckCount, setPrivateDeckCount] = useState(0);
  const [cardsInDecksCount, setCardsInDecksCount] = useState(0);
  const [loadingDeckSection, setLoadingDeckSection] = useState(true);
  const [deckSectionError, setDeckSectionError] = useState("");
  const [favoriteColors, setFavoriteColors] = useState<ColorStat[]>([]);

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
          "id, nickname, bio, avatar_url, favorite_card_oracle_id, favorite_card_printing_id, created_at"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar perfil:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setUserId(user.id);
        setProfile(data as Profile);
        setBio(data.bio ?? "");

        const [
          { count: followersTotal, error: followersError },
          { count: followingTotal, error: followingError },
        ] = await Promise.all([
          supabase
            .from("profile_follows")
            .select("follower_id", { count: "exact", head: true })
            .eq("following_id", user.id),
          supabase
            .from("profile_follows")
            .select("following_id", { count: "exact", head: true })
            .eq("follower_id", user.id),
        ]);

        if (followersError) {
          console.warn(
            "Não foi possível carregar seguidores:",
            followersError.message
          );
        } else {
          setFollowerCount(followersTotal ?? 0);
        }

        if (followingError) {
          console.warn(
            "Não foi possível carregar quem você segue:",
            followingError.message
          );
        } else {
          setFollowingCount(followingTotal ?? 0);
        }
      }

      setLoading(false);
    }

    loadProfile();
  }, [router, supabase]);

  useEffect(() => {
    let cancelled = false;

    async function loadFavoriteCard() {
      const printingId = profile?.favorite_card_printing_id;

      if (!printingId) {
        setFavoriteCard(null);
        setFavoriteCardError("");
        setLoadingFavoriteCard(false);
        return;
      }

      setLoadingFavoriteCard(true);
      setFavoriteCardError("");

      try {
        const response = await fetch(
          `https://api.scryfall.com/cards/${encodeURIComponent(printingId)}`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Scryfall respondeu com status ${response.status}.`
          );
        }

        const card = (await response.json()) as ScryfallCard;

        if (!cancelled) {
          setFavoriteCard(card);
        }
      } catch (error) {
        console.error("Erro ao carregar carta favorita:", error);

        if (!cancelled) {
          setFavoriteCard(null);
          setFavoriteCardError(
            "Não foi possível carregar os dados da carta no Scryfall."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingFavoriteCard(false);
        }
      }
    }

    loadFavoriteCard();

    return () => {
      cancelled = true;
    };
  }, [profile?.favorite_card_printing_id]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadProfileDecks() {
      setDeckSectionError("");

      const { data: deckRows, error: decksError } = await supabase
        .from("decks")
        .select(
          "id, name, format, is_public, commander_scryfall_id, updated_at"
        )
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (decksError) {
        console.error("Erro ao carregar decks do perfil:", decksError);
        setProfileDecks([]);
        setPublicDeckCount(0);
        setPrivateDeckCount(0);
        setCardsInDecksCount(0);
        setFavoriteColors([]);
        setDeckSectionError("Não foi possível carregar seus decks.");
        setLoadingDeckSection(false);
        return;
      }

      const decks = (deckRows ?? []) as ProfileDeck[];

      if (decks.length === 0) {
        setProfileDecks([]);
        setPublicDeckCount(0);
        setPrivateDeckCount(0);
        setCardsInDecksCount(0);
        setFavoriteColors([]);
        setLoadingDeckSection(false);
        return;
      }

      const deckIds = decks.map((deck) => deck.id);

      const { data: cardRows, error: cardsError } = await supabase
        .from("deck_cards")
        .select("deck_id, scryfall_id, oracle_id, quantity, board")
        .in("deck_id", deckIds);

      if (cancelled) return;

      if (cardsError) {
        console.warn(
          "Não foi possível contar as cartas dos decks:",
          cardsError.message
        );
      }

      const cardCountsByDeck = new Map<string, number>();
      let totalCards = 0;

      for (const row of (cardRows ?? []) as ProfileDeckCardRow[]) {
        if (row.board !== "mainboard" && row.board !== "commander") {
          continue;
        }

        const quantity = Math.max(0, Number(row.quantity) || 0);

        cardCountsByDeck.set(
          row.deck_id,
          (cardCountsByDeck.get(row.deck_id) ?? 0) + quantity
        );

        totalCards += quantity;
      }

      const playableCardRows = ((cardRows ?? []) as ProfileDeckCardRow[]).filter(
        (row) => row.board === "mainboard" || row.board === "commander"
      );

      const uniqueScryfallIds = Array.from(
        new Set(
          playableCardRows
            .map((row) => row.scryfall_id)
            .filter(Boolean)
        )
      );

      const colorCards: ProfileColorCardRow[] = [];

      for (const idChunk of chunk(uniqueScryfallIds, 100)) {
        const { data: colorRows, error: colorError } = await supabase
          .from("cards")
          .select("scryfall_id, color_identity")
          .in("scryfall_id", idChunk);

        if (colorError) {
          console.warn(
            "Não foi possível calcular as cores mais usadas:",
            colorError.message
          );
          continue;
        }

        colorCards.push(
          ...((colorRows ?? []) as ProfileColorCardRow[])
        );
      }

      const colorsByScryfall = new Map(
        colorCards.map((card) => [
          card.scryfall_id,
          normalizeColorIdentity(card.color_identity),
        ])
      );

      const colorTotals: Record<ManaColor, number> = {
        W: 0,
        U: 0,
        B: 0,
        R: 0,
        G: 0,
      };

      for (const row of playableCardRows) {
        const quantity = Math.max(1, Number(row.quantity) || 1);
        const identity = colorsByScryfall.get(row.scryfall_id) ?? [];

        for (const color of identity) {
          colorTotals[color] += quantity;
        }
      }

      setFavoriteColors(
        (Object.entries(colorTotals) as Array<[ManaColor, number]>)
          .filter(([, count]) => count > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([color, count]) => ({ color, count }))
      );

      const summaries: ProfileDeckSummary[] = decks.map((deck) => ({
        ...deck,
        card_count: cardCountsByDeck.get(deck.id) ?? 0,
      }));

      setProfileDecks(summaries);
      setPublicDeckCount(decks.filter((deck) => deck.is_public).length);
      setPrivateDeckCount(decks.filter((deck) => !deck.is_public).length);
      setCardsInDecksCount(totalCards);
      setLoadingDeckSection(false);
    }

    void loadProfileDecks();

    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  async function openSocialModal(mode: SocialModalMode) {
    if (!userId || socialLoading) return;

    setSocialModal(mode);
    setSocialProfiles([]);
    setSocialError("");
    setSocialLoading(true);

    try {
      const idColumn =
        mode === "followers" ? "follower_id" : "following_id";
      const filterColumn =
        mode === "followers" ? "following_id" : "follower_id";

      const { data: followRows, error: followError } = await supabase
        .from("profile_follows")
        .select(idColumn)
        .eq(filterColumn, userId)
        .order("created_at", { ascending: false });

      if (followError) {
        throw followError;
      }

      const ids = Array.from(
        new Set(
          (followRows ?? [])
            .map((row) => {
              const value = row as Record<string, unknown>;
              return typeof value[idColumn] === "string"
                ? (value[idColumn] as string)
                : null;
            })
            .filter((value): value is string => Boolean(value))
        )
      );

      if (ids.length === 0) {
        setSocialProfiles([]);
        return;
      }

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url, bio")
        .in("id", ids);

      if (profilesError) {
        throw profilesError;
      }

      const profilesById = new Map(
        ((profileRows ?? []) as SocialProfile[]).map((item) => [
          item.id,
          item,
        ])
      );

      setSocialProfiles(
        ids
          .map((id) => profilesById.get(id))
          .filter((item): item is SocialProfile => Boolean(item))
      );
    } catch (error) {
      console.error("Erro ao carregar conexões do perfil:", error);
      setSocialError("Não foi possível carregar esta lista.");
    } finally {
      setSocialLoading(false);
    }
  }

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

  const favoriteCardImage =
    favoriteCard?.image_uris?.normal ??
    favoriteCard?.image_uris?.large ??
    favoriteCard?.card_faces?.find(
      (face) => face.image_uris?.normal || face.image_uris?.large
    )?.image_uris?.normal ??
    favoriteCard?.card_faces?.find(
      (face) => face.image_uris?.normal || face.image_uris?.large
    )?.image_uris?.large ??
    null;

  const favoriteCardArt =
    favoriteCard?.image_uris?.art_crop ??
    favoriteCard?.card_faces?.find((face) => face.image_uris?.art_crop)
      ?.image_uris?.art_crop ??
    null;

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-6 py-10 text-[#f4f1e8] md:px-10">
      <div className="mx-auto max-w-6xl">

        {/* VOLTAR */}
        <Link
          href="/"
          className="text-sm text-white/40 transition hover:text-white"
        >
          ← CurveOut
        </Link>

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

              {formatCurveOutSince(profile.created_at) && (
                <p className="mt-2 text-xs text-white/25">
                  No CurveOut desde{" "}
                  <span className="text-white/40">
                    {formatCurveOutSince(profile.created_at)}
                  </span>
                </p>
              )}

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

              <div className="mt-6 flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={() => {
                    void openSocialModal("followers");
                  }}
                  className="group flex items-baseline gap-1.5 text-sm transition"
                >
                  <span className="font-semibold text-[#f4f1e8]">
                    {followerCount}
                  </span>
                  <span className="text-white/35 transition group-hover:text-white/60">
                    {followerCount === 1 ? "seguidor" : "seguidores"}
                  </span>
                </button>

                <span className="h-3 w-px bg-white/10" />

                <button
                  type="button"
                  onClick={() => {
                    void openSocialModal("following");
                  }}
                  className="group flex items-baseline gap-1.5 text-sm transition"
                >
                  <span className="font-semibold text-[#f4f1e8]">
                    {followingCount}
                  </span>
                  <span className="text-white/35 transition group-hover:text-white/60">
                    seguindo
                  </span>
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[10px] uppercase tracking-[0.16em] text-white/20">
                  Cores mais usadas
                </span>

                {loadingDeckSection ? (
                  <span className="text-xs text-white/20">calculando...</span>
                ) : favoriteColors.length === 0 ? (
                  <span className="text-xs text-white/20">—</span>
                ) : (
                  favoriteColors.map(({ color }) => {
                    const meta = manaColorMeta[color];

                    return (
                      <span
                        key={color}
                        title={meta.label}
                        className={`
                          flex h-7 min-w-7 items-center justify-center
                          rounded-full border px-2
                          text-[10px] font-semibold
                          ${meta.className}
                        `}
                      >
                        {color}
                      </span>
                    );
                  })
                )}
              </div>

              {message && (
                <p className="mt-4 text-sm text-white/45">
                  {message}
                </p>
              )}
            </div>

            {/* AÇÕES DO PERFIL */}
            <div className="flex shrink-0 flex-wrap gap-2 self-start">
              <Link
                href="/usuarios"
                className="
                  rounded-lg
                  border border-[#c8b27a]/20
                  bg-[#c8b27a]/[0.035]
                  px-4 py-2.5
                  text-sm text-[#e6d8b6]/60
                  transition
                  hover:border-[#c8b27a]/40
                  hover:bg-[#c8b27a]/[0.07]
                  hover:text-[#f4e7c5]
                "
              >
                Encontrar pessoas
              </Link>

              <Link
                href={`/perfil/${encodeURIComponent(profile.nickname)}`}
                className="
                  rounded-lg
                  border border-white/10
                  px-4 py-2.5
                  text-sm text-white/40
                  transition
                  hover:border-white/25
                  hover:text-white/70
                "
              >
                Ver perfil público
              </Link>

              <Link
                href="/configuracoes"
                className="
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
              </Link>
            </div>
          </div>
        </section>

        {/* CARTA FAVORITA */}
        <section className="border-b border-white/10 py-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#c8b27a]/55">
                CurveOut // Identidade
              </p>

              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Carta favorita
              </h2>
            </div>

            <Link
              href="/perfil/carta-favorita"
              className="
                rounded-lg
                border border-[#c8b27a]/25
                bg-[#c8b27a]/[0.04]
                px-5 py-2.5
                text-sm text-[#e6d8b6]/75
                transition
                hover:border-[#c8b27a]/50
                hover:bg-[#c8b27a]/[0.08]
                hover:text-[#f4e7c5]
              "
            >
              {profile.favorite_card_printing_id
                ? "Trocar carta"
                : "+ Escolher carta"}
            </Link>
          </div>

          {profile.favorite_card_printing_id ? (
            <div
              className="
                group relative overflow-hidden
                rounded-[1.4rem]
                border border-white/10
                bg-[#111114]
                shadow-[0_28px_80px_rgba(0,0,0,0.28)]
              "
            >
              {favoriteCardArt && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 scale-110 bg-cover bg-center opacity-[0.13] blur-2xl transition duration-700 group-hover:scale-[1.14] group-hover:opacity-[0.16]"
                  style={{ backgroundImage: `url(${favoriteCardArt})` }}
                />
              )}

              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,11,13,0.96)_0%,rgba(11,11,13,0.88)_42%,rgba(11,11,13,0.78)_100%)]"
              />

              <div
                aria-hidden="true"
                className="absolute left-0 top-0 h-px w-32 bg-gradient-to-r from-[#c8b27a]/70 to-transparent"
              />

              <div
                className="
                  relative z-10 grid gap-9
                  p-6
                  md:grid-cols-[240px_1fr]
                  md:items-center
                  md:p-9
                  lg:gap-12
                  lg:p-10
                "
              >
                <div className="mx-auto w-full max-w-[240px] md:mx-0">
                  <div className="relative">
                    <div
                      aria-hidden="true"
                      className="absolute -inset-3 rounded-[7%] border border-[#c8b27a]/10 opacity-0 transition duration-500 group-hover:opacity-100"
                    />

                    {loadingFavoriteCard ? (
                      <div className="aspect-[488/680] animate-pulse rounded-[4.75%] border border-white/10 bg-white/[0.04]" />
                    ) : favoriteCardImage ? (
                      <img
                        src={favoriteCardImage}
                        alt={
                          favoriteCard
                            ? `Carta ${favoriteCard.name}`
                            : "Carta favorita"
                        }
                        className="
                          aspect-[488/680]
                          w-full
                          -rotate-[0.7deg]
                          rounded-[4.75%]
                          object-cover
                          shadow-[0_24px_55px_rgba(0,0,0,0.55)]
                          transition duration-500
                          group-hover:-translate-y-1
                          group-hover:rotate-0
                        "
                      />
                    ) : (
                      <div
                        className="
                          flex aspect-[488/680]
                          items-center justify-center
                          rounded-[4.75%]
                          border border-dashed border-white/10
                          bg-black/20
                          px-5 text-center
                          text-sm text-white/30
                        "
                      >
                        {favoriteCardError ||
                          "Imagem indisponível para esta carta."}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center md:text-left">
                  {loadingFavoriteCard ? (
                    <div className="space-y-3">
                      <div className="mx-auto h-3 w-28 animate-pulse rounded bg-white/[0.06] md:mx-0" />
                      <div className="mx-auto h-10 w-72 max-w-full animate-pulse rounded bg-white/[0.06] md:mx-0" />
                      <div className="mx-auto h-4 w-48 animate-pulse rounded bg-white/[0.04] md:mx-0" />
                    </div>
                  ) : favoriteCard ? (
                    <>
                      <div className="flex items-center justify-center gap-3 md:justify-start">
                        <span className="h-px w-7 bg-[#c8b27a]/45" />
                        <p className="text-[11px] uppercase tracking-[0.3em] text-[#c8b27a]/60">
                          Favorite card
                        </p>
                      </div>

                      <h3 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.025em] text-[#f4f1e8] md:text-5xl">
                        {favoriteCard.name}
                      </h3>

                      <p className="mt-4 text-sm uppercase tracking-[0.12em] text-white/35">
                        {favoriteCard.set_name}
                        <span className="mx-2 text-[#c8b27a]/30">{"//"}</span>
                        {favoriteCard.set.toUpperCase()}
                        <span className="mx-2 text-[#c8b27a]/30">{"//"}</span>
                        #{favoriteCard.collector_number}
                      </p>

                      <p className="mx-auto mt-7 max-w-xl leading-7 text-white/42 md:mx-0">
                        A carta que melhor representa seu perfil dentro do
                        CurveOut. Uma escolha pessoal, não necessariamente a
                        mais forte do deck.
                      </p>

                      <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
                        <Link
                          href="/perfil/carta-favorita"
                          className="
                            rounded-lg
                            border border-white/15
                            bg-white/[0.025]
                            px-5 py-2.5
                            text-sm text-white/70
                            transition
                            hover:border-[#c8b27a]/35
                            hover:text-white
                          "
                        >
                          Trocar carta
                        </Link>

                        {favoriteCard.scryfall_uri && (
                          <a
                            href={favoriteCard.scryfall_uri}
                            target="_blank"
                            rel="noreferrer"
                            className="
                              rounded-lg
                              px-4 py-2.5
                              text-sm text-white/35
                              transition
                              hover:text-[#d9c690]/80
                            "
                          >
                            Ver no Scryfall ↗
                          </a>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-white/55">
                        Carta favorita salva.
                      </p>

                      <p className="mt-2 text-sm text-white/30">
                        {favoriteCardError ||
                          "Não foi possível carregar os dados da carta."}
                      </p>

                      <Link
                        href="/perfil/carta-favorita"
                        className="mt-5 inline-block text-sm text-white/70 underline underline-offset-4 transition hover:text-white"
                      >
                        Trocar carta favorita
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="
                relative overflow-hidden
                rounded-[1.4rem]
                border border-dashed border-[#c8b27a]/20
                bg-[#c8b27a]/[0.018]
                px-6 py-16 text-center
              "
            >
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-0 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#c8b27a]/45 to-transparent"
              />

              <div className="relative">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-[#c8b27a]/15 text-2xl text-[#c8b27a]/30">
                  ♠
                </div>

                <p className="text-white/55">
                  Nenhuma carta favorita escolhida.
                </p>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/28">
                  Escolha uma carta que represente seu perfil dentro do
                  CurveOut.
                </p>

                <Link
                  href="/perfil/carta-favorita"
                  className="mt-6 inline-block rounded-lg border border-[#c8b27a]/25 px-5 py-2.5 text-sm text-[#e6d8b6]/70 transition hover:border-[#c8b27a]/50 hover:text-[#f4e7c5]"
                >
                  Escolher minha carta
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* DECKS */}
        <section className="py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                Deckbuilding
              </p>

              <h2 className="mt-2 text-3xl font-semibold">
                Decks
              </h2>
            </div>

            <Link
              href="/meus-decks"
              className="text-sm text-white/40 transition hover:text-white"
            >
              Ver todos →
            </Link>
          </div>

          {deckSectionError && (
            <p className="mt-5 rounded-xl border border-red-300/10 bg-red-300/[0.03] px-4 py-3 text-sm text-red-100/55">
              {deckSectionError}
            </p>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Link
              href="/meus-decks"
              className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.035]"
            >
              <p className="text-3xl font-semibold">
                {loadingDeckSection ? "—" : publicDeckCount}
              </p>

              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-sm text-white/35">
                  Decks públicos
                </p>

                <span className="text-xs text-white/15 transition group-hover:text-white/40">
                  →
                </span>
              </div>
            </Link>

            <Link
              href="/meus-decks"
              className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.035]"
            >
              <p className="text-3xl font-semibold">
                {loadingDeckSection ? "—" : privateDeckCount}
              </p>

              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-sm text-white/35">
                  Decks privados
                </p>

                <span className="text-xs text-white/15 transition group-hover:text-white/40">
                  →
                </span>
              </div>
            </Link>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-3xl font-semibold">
                {loadingDeckSection ? "—" : cardsInDecksCount}
              </p>

              <p className="mt-1 text-sm text-white/35">
                Cartas nos decks
              </p>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
                Atualizados recentemente
              </p>

              {!loadingDeckSection && profileDecks.length > 3 && (
                <Link
                  href="/meus-decks"
                  className="text-xs text-white/25 transition hover:text-white/55"
                >
                  Ver biblioteca completa
                </Link>
              )}
            </div>

            {loadingDeckSection ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-32 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.015]"
                  />
                ))}
              </div>
            ) : profileDecks.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-12 text-center">
                <p className="text-sm text-white/35">
                  Você ainda não criou nenhum deck.
                </p>

                <Link
                  href="/decks/novo"
                  className="mt-5 inline-flex rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white/60 transition hover:border-white/30 hover:text-white"
                >
                  Criar primeiro deck
                </Link>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {profileDecks.slice(0, 3).map((deck) => (
                  <Link
                    key={deck.id}
                    href={`/decks/${deck.id}`}
                    className="
                      group relative overflow-hidden
                      rounded-xl border border-white/10
                      bg-[#101013] p-5
                      transition
                      hover:-translate-y-0.5
                      hover:border-white/20
                      hover:bg-white/[0.03]
                    "
                  >
                    <div
                      aria-hidden="true"
                      className="absolute left-0 top-0 h-px w-20 bg-gradient-to-r from-[#c8b27a]/45 to-transparent opacity-60"
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/20">
                          {deck.format}
                        </p>

                        <h3 className="mt-2 truncate text-lg font-semibold text-white/75 transition group-hover:text-white">
                          {deck.name}
                        </h3>
                      </div>

                      <span
                        className={`
                          shrink-0 rounded-full border px-2 py-1
                          text-[9px] uppercase tracking-[0.12em]
                          ${
                            deck.is_public
                              ? "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-100/45"
                              : "border-white/10 bg-white/[0.025] text-white/25"
                          }
                        `}
                      >
                        {deck.is_public ? "Público" : "Privado"}
                      </span>
                    </div>

                    <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/[0.07] pt-4">
                      <div>
                        <p className="text-xl font-semibold text-white/65">
                          {deck.card_count}
                        </p>
                        <p className="mt-0.5 text-[10px] text-white/20">
                          {deck.card_count === 1 ? "carta" : "cartas"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] text-white/20">
                          Atualizado
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/35">
                          {new Intl.DateTimeFormat("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          }).format(new Date(deck.updated_at))}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {socialModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSocialModal(null);
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[#101013] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">
                  @{profile.nickname}
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  {socialModal === "followers" ? "Seguidores" : "Seguindo"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSocialModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/35 transition hover:border-white/20 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-3">
              {socialLoading ? (
                <p className="px-3 py-8 text-center text-sm text-white/30">
                  Carregando...
                </p>
              ) : socialError ? (
                <p className="px-3 py-8 text-center text-sm text-red-100/55">
                  {socialError}
                </p>
              ) : socialProfiles.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-white/30">
                  {socialModal === "followers"
                    ? "Ainda não há seguidores."
                    : "Você ainda não segue ninguém."}
                </p>
              ) : (
                <div className="space-y-1">
                  {socialProfiles.map((item) => (
                    <Link
                      key={item.id}
                      href={`/perfil/${encodeURIComponent(item.nickname)}`}
                      onClick={() => setSocialModal(null)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[0.045]"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] text-sm font-semibold">
                        {item.avatar_url ? (
                          <img
                            src={item.avatar_url}
                            alt={`Foto de @${item.nickname}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          item.nickname.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white/75">
                          @{item.nickname}
                        </p>
                        {item.bio && (
                          <p className="mt-0.5 truncate text-xs text-white/25">
                            {item.bio}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}