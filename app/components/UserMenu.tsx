"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Profile = {
  nickname: string;
  avatar_url: string | null;
};

export default function UserMenu() {
  const [supabase] = useState(() => createClient());

  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoggedIn(false);
        setNickname(null);
        setAvatarUrl(null);
        setLoading(false);
        return;
      }

      setLoggedIn(true);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("nickname, avatar_url")
        .eq("id", user.id)
        .maybeSingle<Profile>();

      if (error) {
        console.error("Erro ao carregar perfil:", error);
      }

      setNickname(profile?.nickname ?? null);
      setAvatarUrl(profile?.avatar_url ?? null);
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return <div className="h-10 w-10" />;
  }

  if (!loggedIn) {
    return (
      <div className="flex items-center gap-3">
        <a
          href="/auth/login"
          className="hidden px-4 py-2 text-sm text-white/70 transition hover:text-white sm:block"
        >
          Entrar
        </a>

        <a
          href="/auth/register"
          className="rounded-lg bg-[#f4f1e8] px-4 py-2 text-sm font-semibold text-black transition hover:bg-white"
        >
          Criar conta
        </a>
      </div>
    );
  }

  const initial = nickname
    ? nickname.charAt(0).toUpperCase()
    : "?";

  return (
    <div
      ref={menuRef}
      className="relative"
    >
      {/* AVATAR DO HEADER */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Abrir menu do usuário"
        aria-expanded={open}
        className="
          flex h-10 w-10
          items-center justify-center
          overflow-hidden
          rounded-full
          border border-white/15
          bg-white/[0.05]
          text-sm font-semibold
          text-[#f4f1e8]
          transition
          hover:border-white/30
          hover:bg-white/[0.08]
          active:scale-95
        "
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={nickname ? `Foto de @${nickname}` : "Foto de perfil"}
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <span>{initial}</span>
        )}
      </button>

      {/* DROPDOWN */}
      <div
  className={`
    absolute right-0 top-12 z-50
    w-64
    origin-top-right
    overflow-hidden
    rounded-xl
    border border-white/10
    bg-[#111113]
    shadow-2xl

    transition-all
    duration-500
    ease-out

    ${
      open
        ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
        : "pointer-events-none -translate-y-2 scale-95 opacity-0"
    }
  `}
>
          {/* USUÁRIO */}
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
            <div
              className="
                flex h-10 w-10 shrink-0
                items-center justify-center
                overflow-hidden
                rounded-full
                border border-white/10
                bg-white/[0.05]
                text-sm font-semibold
              "
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={nickname ? `Foto de @${nickname}` : "Foto de perfil"}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#f4f1e8]">
                {nickname ? `@${nickname}` : "Meu perfil"}
              </p>

              <p className="mt-0.5 text-xs text-white/35">
                Conta CurveOut
              </p>
            </div>
          </div>

          {/* MENU */}
          <div className="p-2">
            <a
              href="/perfil"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Perfil
            </a>

            <a
              href="/decks/novo"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Criar deck
            </a>

            <a
              href="/meus-decks"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Meus decks
            </a>

            <a
              href="/minha-colecao"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Minha coleção
            </a>

            <a
              href="/configuracoes"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Configurações
            </a>
          </div>

          {/* SAIR */}
          <div className="border-t border-white/10 p-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
            >
              Sair
            </button>
          </div>
        </div>
    </div>
  );
}