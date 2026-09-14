"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

type PublicProfile = {
  id: string;
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
  favorite_card_printing_id: string | null;
  created_at: string | null;
};

type PublicDeck = {
  id: string;
  name: string;
  format: string;
  updated_at: string;
};

type SocialProfile = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
};

type SocialModalMode = "followers" | "following";

type PublicDeckCardRow = {
  deck_id: string;
  scryfall_id: string;
  quantity: number;
  board: string;
};

type PublicColorCardRow = {
  scryfall_id: string;
  color_identity: unknown;
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


function formatRelativeDate(value: string) {
  const timestamp = new Date(value).getTime();
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "agora";
  if (diffMs < hour) return `há ${Math.floor(diffMs / minute)} min`;
  if (diffMs < day) return `há ${Math.floor(diffMs / hour)} h`;

  const days = Math.floor(diffMs / day);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export default function PublicProfilePage() {
  const params = useParams<{ nickname: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const nickname = decodeURIComponent(params.nickname ?? "");

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [decks, setDecks] = useState<PublicDeck[]>([]);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followSaving, setFollowSaving] = useState(false);
  const [favoriteColors, setFavoriteColors] = useState<ColorStat[]>([]);
  const [mutualFollowers, setMutualFollowers] = useState<SocialProfile[]>([]);

  const [socialModal, setSocialModal] =
    useState<SocialModalMode | null>(null);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPublicProfile() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      if (!cancelled) {
        setViewerId(user.id);
      }

      const { data: targetProfile, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, nickname, bio, avatar_url, favorite_card_printing_id, created_at"
        )
        .ilike("nickname", nickname)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        console.error("Erro ao carregar perfil público:", profileError);
        setErrorMessage("Não foi possível carregar este perfil.");
        setLoading(false);
        return;
      }

      if (!targetProfile) {
        setErrorMessage("Perfil não encontrado.");
        setLoading(false);
        return;
      }

      const publicProfile = targetProfile as PublicProfile;
      setProfile(publicProfile);

      const [
        { count: followersTotal, error: followersError },
        { count: followingTotal, error: followingError },
        { data: followRow, error: followError },
        { data: publicDecks, error: decksError },
        { data: viewerFollowingRows, error: viewerFollowingError },
        { data: targetFollowerRows, error: targetFollowersError },
      ] = await Promise.all([
        supabase
          .from("profile_follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", publicProfile.id),
        supabase
          .from("profile_follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", publicProfile.id),
        supabase
          .from("profile_follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("following_id", publicProfile.id)
          .maybeSingle(),
        supabase
          .from("decks")
          .select("id, name, format, updated_at")
          .eq("owner_id", publicProfile.id)
          .eq("is_public", true)
          .order("updated_at", { ascending: false })
          .limit(6),
        supabase
          .from("profile_follows")
          .select("following_id")
          .eq("follower_id", user.id),
        supabase
          .from("profile_follows")
          .select("follower_id")
          .eq("following_id", publicProfile.id),
      ]);

      if (cancelled) return;

      if (!followersError) setFollowerCount(followersTotal ?? 0);
      if (!followingError) setFollowingCount(followingTotal ?? 0);
      if (!followError) setIsFollowing(Boolean(followRow));

      const visibleDecks = decksError
        ? []
        : ((publicDecks ?? []) as PublicDeck[]);

      if (decksError) {
        console.warn("Não foi possível carregar decks públicos:", decksError);
      }

      setDecks(visibleDecks);

      if (visibleDecks.length > 0) {
        const deckIds = visibleDecks.map((deck) => deck.id);

        const { data: deckCardRows, error: deckCardsError } = await supabase
          .from("deck_cards")
          .select("deck_id, scryfall_id, quantity, board")
          .in("deck_id", deckIds);

        if (cancelled) return;

        if (deckCardsError) {
          console.warn(
            "Não foi possível calcular as cores do perfil:",
            deckCardsError.message
          );
          setFavoriteColors([]);
        } else {
          const playableRows = ((deckCardRows ?? []) as PublicDeckCardRow[]).filter(
            (row) => row.board === "mainboard" || row.board === "commander"
          );

          const scryfallIds = Array.from(
            new Set(playableRows.map((row) => row.scryfall_id).filter(Boolean))
          );

          const colorCards: PublicColorCardRow[] = [];

          for (const idChunk of chunk(scryfallIds, 100)) {
            const { data: colorRows, error: colorError } = await supabase
              .from("cards")
              .select("scryfall_id, color_identity")
              .in("scryfall_id", idChunk);

            if (colorError) {
              console.warn(
                "Não foi possível ler as cores das cartas:",
                colorError.message
              );
              continue;
            }

            colorCards.push(...((colorRows ?? []) as PublicColorCardRow[]));
          }

          const colorsByScryfall = new Map(
            colorCards.map((card) => [
              card.scryfall_id,
              normalizeColorIdentity(card.color_identity),
            ])
          );

          const totals: Record<ManaColor, number> = {
            W: 0,
            U: 0,
            B: 0,
            R: 0,
            G: 0,
          };

          for (const row of playableRows) {
            const quantity = Math.max(1, Number(row.quantity) || 1);
            const identity = colorsByScryfall.get(row.scryfall_id) ?? [];

            for (const color of identity) {
              totals[color] += quantity;
            }
          }

          setFavoriteColors(
            (Object.entries(totals) as Array<[ManaColor, number]>)
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([color, count]) => ({ color, count }))
          );
        }
      } else {
        setFavoriteColors([]);
      }

      if (!viewerFollowingError && !targetFollowersError) {
        const viewerFollowingIds = new Set(
          (viewerFollowingRows ?? [])
            .map((row) =>
              typeof row.following_id === "string"
                ? row.following_id
                : null
            )
            .filter((value): value is string => Boolean(value))
        );

        const mutualIds = Array.from(
          new Set(
            (targetFollowerRows ?? [])
              .map((row) =>
                typeof row.follower_id === "string"
                  ? row.follower_id
                  : null
              )
              .filter(
                (value): value is string =>
                  Boolean(value) && viewerFollowingIds.has(value)
              )
          )
        ).slice(0, 8);

        if (mutualIds.length > 0) {
          const { data: mutualProfileRows, error: mutualProfilesError } =
            await supabase
              .from("profiles")
              .select("id, nickname, avatar_url, bio")
              .in("id", mutualIds);

          if (!mutualProfilesError) {
            const byId = new Map(
              ((mutualProfileRows ?? []) as SocialProfile[]).map((item) => [
                item.id,
                item,
              ])
            );

            setMutualFollowers(
              mutualIds
                .map((id) => byId.get(id))
                .filter((item): item is SocialProfile => Boolean(item))
            );
          } else {
            setMutualFollowers([]);
          }
        } else {
          setMutualFollowers([]);
        }
      } else {
        setMutualFollowers([]);
      }

      setLoading(false);
    }

    void loadPublicProfile();

    return () => {
      cancelled = true;
    };
  }, [nickname, router, supabase]);

  async function toggleFollow() {
    if (!profile || !viewerId || viewerId === profile.id || followSaving) {
      return;
    }

    setFollowSaving(true);
    setErrorMessage("");

    if (isFollowing) {
      const { error } = await supabase
        .from("profile_follows")
        .delete()
        .eq("follower_id", viewerId)
        .eq("following_id", profile.id);

      if (error) {
        setErrorMessage("Não foi possível deixar de seguir este perfil.");
        setFollowSaving(false);
        return;
      }

      setIsFollowing(false);
      setFollowerCount((current) => Math.max(0, current - 1));
    } else {
      const { error } = await supabase
        .from("profile_follows")
        .insert({
          follower_id: viewerId,
          following_id: profile.id,
        });

      if (error) {
        setErrorMessage("Não foi possível seguir este perfil.");
        setFollowSaving(false);
        return;
      }

      setIsFollowing(true);
      setFollowerCount((current) => current + 1);
    }

    setFollowSaving(false);
  }

  async function openSocialModal(mode: SocialModalMode) {
    if (!profile || socialLoading) return;

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
        .eq(filterColumn, profile.id)
        .order("created_at", { ascending: false });

      if (followError) throw followError;

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

      if (profilesError) throw profilesError;

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
      console.error("Erro ao carregar conexões:", error);
      setSocialError("Não foi possível carregar esta lista.");
    } finally {
      setSocialLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-white/35">
        Carregando perfil...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6 text-center text-white/40">
        <div>
          <p>{errorMessage || "Perfil não encontrado."}</p>
          <Link
            href="/"
            className="mt-5 inline-block text-sm text-white/60 underline underline-offset-4"
          >
            Voltar ao CurveOut
          </Link>
        </div>
      </main>
    );
  }

  const ownProfile = viewerId === profile.id;
  const initial = profile.nickname.charAt(0).toUpperCase();

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-6 py-10 text-[#f4f1e8] md:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="text-sm text-white/35 transition hover:text-white"
        >
          ← CurveOut
        </Link>

        <section className="mt-10 border-b border-white/10 pb-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-center">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/[0.05] text-4xl font-semibold">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`Foto de @${profile.nickname}`}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                initial
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.2em] text-white/25">
                Perfil público
              </p>

              <h1 className="mt-2 break-words text-4xl font-semibold md:text-5xl">
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

              <p className="mt-5 max-w-2xl whitespace-pre-line leading-7 text-white/50">
                {profile.bio || "Este usuário ainda não adicionou uma bio."}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={() => void openSocialModal("followers")}
                  className="group flex items-baseline gap-1.5 text-sm"
                >
                  <span className="font-semibold">{followerCount}</span>
                  <span className="text-white/35 transition group-hover:text-white/60">
                    {followerCount === 1 ? "seguidor" : "seguidores"}
                  </span>
                </button>

                <span className="h-3 w-px bg-white/10" />

                <button
                  type="button"
                  onClick={() => void openSocialModal("following")}
                  className="group flex items-baseline gap-1.5 text-sm"
                >
                  <span className="font-semibold">{followingCount}</span>
                  <span className="text-white/35 transition group-hover:text-white/60">
                    seguindo
                  </span>
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[10px] uppercase tracking-[0.16em] text-white/20">
                  Cores mais usadas
                </span>

                {favoriteColors.length === 0 ? (
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

              {!ownProfile && mutualFollowers.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="flex -space-x-2">
                    {mutualFollowers.slice(0, 3).map((item) => (
                      <Link
                        key={item.id}
                        href={`/perfil/${encodeURIComponent(item.nickname)}`}
                        title={`@${item.nickname}`}
                        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-[#0b0b0d] bg-[#151518] text-[10px] font-semibold text-white/65"
                      >
                        {item.avatar_url ? (
                          <img
                            src={item.avatar_url}
                            alt={`Foto de @${item.nickname}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          item.nickname.charAt(0).toUpperCase()
                        )}
                      </Link>
                    ))}
                  </div>

                  <p className="text-xs text-white/30">
                    <span className="text-white/50">
                      {mutualFollowers.length}
                    </span>{" "}
                    {mutualFollowers.length === 1
                      ? "seguidor em comum"
                      : "seguidores em comum"}
                  </p>
                </div>
              )}

              {errorMessage && (
                <p className="mt-4 text-sm text-red-100/55">
                  {errorMessage}
                </p>
              )}
            </div>

            <div className="shrink-0 self-start">
              {ownProfile ? (
                <Link
                  href="/perfil"
                  className="inline-flex rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white/60 transition hover:border-white/30 hover:text-white"
                >
                  Editar perfil
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={followSaving}
                  onClick={() => void toggleFollow()}
                  className={`
                    min-w-28 rounded-lg px-5 py-2.5 text-sm font-semibold transition
                    disabled:cursor-wait disabled:opacity-50
                    ${
                      isFollowing
                        ? "border border-white/15 bg-white/[0.025] text-white/60 hover:border-red-300/25 hover:text-red-100/65"
                        : "bg-[#f4f1e8] text-black hover:bg-white"
                    }
                  `}
                >
                  {followSaving
                    ? "..."
                    : isFollowing
                      ? "Seguindo"
                      : "Seguir"}
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/25">
                Deckbuilding
              </p>
              <h2 className="mt-2 text-3xl font-semibold">
                Decks públicos
              </h2>
            </div>

            <span className="text-sm text-white/25">
              {decks.length} {decks.length === 1 ? "deck" : "decks"}
            </span>
          </div>

          {decks.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center text-sm text-white/30">
              Nenhum deck público ainda.
            </div>
          ) : (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck) => (
                <Link
                  key={deck.id}
                  href={`/decks/${deck.id}`}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.035]"
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/25">
                    {deck.format}
                  </p>
                  <h3 className="mt-2 truncate text-lg font-semibold text-white/75">
                    {deck.name}
                  </h3>
                  <p className="mt-5 text-xs text-white/25">
                    Atualizado {formatRelativeDate(deck.updated_at)}
                  </p>
                </Link>
              ))}
            </div>
          )}
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
                  Nenhum usuário por aqui ainda.
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
