"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type UserProfile = {
  id: string;
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
};

type UserCard = UserProfile & {
  public_deck_count: number;
  is_following: boolean;
  follows_you: boolean;
};

export default function UsersPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [followSavingId, setFollowSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      async function loadUsers() {
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

        const cleanSearch = search.trim();

        let profilesQuery = supabase
          .from("profiles")
          .select("id, nickname, bio, avatar_url")
          .neq("id", user.id)
          .order("nickname", { ascending: true })
          .limit(40);

        if (cleanSearch) {
          profilesQuery = profilesQuery.ilike(
            "nickname",
            `%${cleanSearch}%`
          );
        }

        const { data: profileRows, error: profilesError } =
          await profilesQuery;

        if (cancelled) return;

        if (profilesError) {
          console.error("Erro ao buscar usuários:", profilesError);
          setUsers([]);
          setErrorMessage("Não foi possível buscar os usuários.");
          setLoading(false);
          return;
        }

        const profiles = (profileRows ?? []) as UserProfile[];

        if (profiles.length === 0) {
          setUsers([]);
          setLoading(false);
          return;
        }

        const ids = profiles.map((profile) => profile.id);

        const [
          { data: deckRows, error: decksError },
          { data: followingRows, error: followingError },
          { data: followerRows, error: followerError },
        ] = await Promise.all([
          supabase
            .from("decks")
            .select("owner_id")
            .in("owner_id", ids)
            .eq("is_public", true),
          supabase
            .from("profile_follows")
            .select("following_id")
            .eq("follower_id", user.id)
            .in("following_id", ids),
          supabase
            .from("profile_follows")
            .select("follower_id")
            .eq("following_id", user.id)
            .in("follower_id", ids),
        ]);

        if (cancelled) return;

        if (decksError) {
          console.warn(
            "Não foi possível contar decks públicos:",
            decksError.message
          );
        }

        if (followingError) {
          console.warn(
            "Não foi possível carregar quem você segue:",
            followingError.message
          );
        }

        if (followerError) {
          console.warn(
            "Não foi possível carregar quem segue você:",
            followerError.message
          );
        }

        const deckCounts = new Map<string, number>();

        for (const row of deckRows ?? []) {
          const ownerId =
            typeof row.owner_id === "string" ? row.owner_id : null;

          if (!ownerId) continue;

          deckCounts.set(ownerId, (deckCounts.get(ownerId) ?? 0) + 1);
        }

        const followingIds = new Set(
          (followingRows ?? [])
            .map((row) =>
              typeof row.following_id === "string"
                ? row.following_id
                : null
            )
            .filter((value): value is string => Boolean(value))
        );

        const followerIds = new Set(
          (followerRows ?? [])
            .map((row) =>
              typeof row.follower_id === "string"
                ? row.follower_id
                : null
            )
            .filter((value): value is string => Boolean(value))
        );

        setUsers(
          profiles.map((profile) => ({
            ...profile,
            public_deck_count: deckCounts.get(profile.id) ?? 0,
            is_following: followingIds.has(profile.id),
            follows_you: followerIds.has(profile.id),
          }))
        );

        setLoading(false);
      }

      void loadUsers();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [router, search, supabase]);

  const resultLabel = useMemo(() => {
    if (loading) return "Buscando...";
    if (users.length === 1) return "1 jogador encontrado";
    return `${users.length} jogadores encontrados`;
  }, [loading, users.length]);

  async function toggleFollow(target: UserCard) {
    if (!viewerId || followSavingId) return;

    setFollowSavingId(target.id);
    setErrorMessage("");

    if (target.is_following) {
      const { error } = await supabase
        .from("profile_follows")
        .delete()
        .eq("follower_id", viewerId)
        .eq("following_id", target.id);

      if (error) {
        setErrorMessage(
          "Não foi possível deixar de seguir este usuário."
        );
        setFollowSavingId(null);
        return;
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === target.id
            ? { ...item, is_following: false }
            : item
        )
      );
    } else {
      const { error } = await supabase
        .from("profile_follows")
        .insert({
          follower_id: viewerId,
          following_id: target.id,
        });

      if (error) {
        setErrorMessage("Não foi possível seguir este usuário.");
        setFollowSavingId(null);
        return;
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === target.id
            ? { ...item, is_following: true }
            : item
        )
      );
    }

    setFollowSavingId(null);
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-5 py-10 text-[#f4f1e8] md:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/perfil"
          className="text-sm text-white/35 transition hover:text-white"
        >
          ← Perfil
        </Link>

        <section className="mt-10">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-[#c8b27a]/55">
              CurveOut {"//"} Comunidade
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              Encontrar jogadores
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-white/35">
              Procure outros jogadores do CurveOut, visite seus perfis
              e acompanhe os decks públicos que eles estão construindo.
            </p>
          </div>

          <div className="mt-10">
            <label
              htmlFor="user-search"
              className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/25"
            >
              Procurar jogador
            </label>

            <div className="relative">
              <input
                id="user-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite um nickname..."
                autoComplete="off"
                className="
                  w-full rounded-xl
                  border border-white/10
                  bg-[#111114]
                  px-4 py-3.5 pr-12
                  text-sm text-white/75
                  outline-none transition
                  placeholder:text-white/20
                  focus:border-white/25
                "
              />

              {search && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setSearch("")}
                  className="
                    absolute right-3 top-1/2
                    -translate-y-1/2
                    rounded-md px-2 py-1
                    text-sm text-white/25
                    transition hover:text-white/60
                  "
                >
                  ×
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-white/25">{resultLabel}</p>

              <p className="text-[11px] text-white/20">
                Busque pelo nickname
              </p>
            </div>

            {errorMessage && (
              <p className="mt-4 rounded-xl border border-red-300/10 bg-red-300/[0.03] px-4 py-3 text-sm text-red-100/55">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="mt-8">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.015]"
                  />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-16 text-center">
                <p className="text-sm text-white/35">
                  {search.trim()
                    ? "Nenhum jogador encontrado com esse nickname."
                    : "Ainda não há outros jogadores para mostrar."}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {users.map((user) => (
                  <article
                    key={user.id}
                    className="
                      group relative rounded-2xl
                      border border-white/10
                      bg-white/[0.02] p-4
                      transition
                      hover:border-white/20
                      hover:bg-white/[0.035]
                    "
                  >
                    <div className="flex items-start gap-4">
                      <Link
                        href={`/perfil/${encodeURIComponent(
                          user.nickname
                        )}`}
                        className="
                          flex h-16 w-16 shrink-0
                          items-center justify-center
                          overflow-hidden rounded-full
                          border border-white/10
                          bg-white/[0.04]
                          text-lg font-semibold
                        "
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={`Foto de @${user.nickname}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          user.nickname.charAt(0).toUpperCase()
                        )}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <Link
                            href={`/perfil/${encodeURIComponent(
                              user.nickname
                            )}`}
                            className="min-w-0 truncate text-base font-semibold text-white/80 transition hover:text-white"
                          >
                            @{user.nickname}
                          </Link>

                          {user.follows_you && (
                            <span className="shrink-0 rounded-md bg-white/[0.05] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/30">
                              Segue você
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-white/25">
                          {user.public_deck_count}{" "}
                          {user.public_deck_count === 1
                            ? "deck público"
                            : "decks públicos"}
                        </p>

                        <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-white/35">
                          {user.bio ||
                            "Este jogador ainda não adicionou uma bio."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                      <Link
                        href={`/perfil/${encodeURIComponent(
                          user.nickname
                        )}`}
                        className="text-xs text-white/25 transition hover:text-white/60"
                      >
                        Ver perfil →
                      </Link>

                      <button
                        type="button"
                        disabled={followSavingId === user.id}
                        onClick={() => void toggleFollow(user)}
                        className={`
                          min-w-24 rounded-lg px-3 py-2
                          text-xs font-semibold transition
                          disabled:cursor-wait disabled:opacity-45
                          ${
                            user.is_following
                              ? "border border-white/12 bg-white/[0.025] text-white/45 hover:border-red-300/20 hover:text-red-100/60"
                              : "bg-[#f4f1e8] text-black hover:bg-white"
                          }
                        `}
                      >
                        {followSavingId === user.id
                          ? "..."
                          : user.is_following
                            ? "Seguindo"
                            : "Seguir"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
