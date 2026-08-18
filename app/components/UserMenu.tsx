"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function UserMenu() {
  const [supabase] = useState(() => createClient());

  const [nickname, setNickname] = useState<string | null>(null);
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
        setLoading(false);
        return;
      }

      setLoggedIn(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", user.id)
        .maybeSingle();

      setNickname(profile?.nickname ?? null);
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
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Abrir menu do usuário"
        aria-expanded={open}
        className="
          flex h-10 w-10 items-center justify-center
          rounded-full
          border border-white/15
          bg-white/[0.05]
          text-sm font-semibold
          text-[#f4f1e8]
          transition
          hover:border-white/30
          hover:bg-white/[0.08]
        "
      >
        {initial}
      </button>

      {open && (
        <div
          className="
            absolute right-0 top-12 z-50
            w-64
            overflow-hidden
            rounded-xl
            border border-white/10
            bg-[#111113]
            shadow-2xl
          "
        >
          <div className="border-b border-white/10 px-4 py-4">
            <p className="text-sm font-medium text-[#f4f1e8]">
              {nickname ? `@${nickname}` : "Meu perfil"}
            </p>

            <p className="mt-1 text-xs text-white/35">
              Conta CurveOut
            </p>
          </div>

          <div className="p-2">
            <a
              href="/perfil"
              className="block rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Perfil
            </a>

            <a
              href="/decks/novo"
              className="block rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Novo deck
            </a>

            <a
              href="/meus-decks"
              className="block rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Meus decks
            </a>

            <a
              href="/minha-colecao"
              className="block rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Minha coleção
            </a>

            <a
              href="/configuracoes"
              className="block rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Configurações
            </a>
          </div>

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
      )}
    </div>
  );
}