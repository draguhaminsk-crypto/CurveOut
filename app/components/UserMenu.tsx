"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createClient } from "../../lib/supabase/client";

type Profile = {
  nickname: string | null;
  avatar_url: string | null;
};

export default function UserMenu() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const menuRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setUserId(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select("nickname, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error(
          "Erro ao carregar perfil no menu:",
          error
        );

        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile((data ?? null) as Profile | null);
      setLoading(false);
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setOpen(false);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Erro ao sair:", error);
      setSigningOut(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div
        className="
          h-10 w-10
          animate-pulse
          rounded-full
          border border-white/10
          bg-white/[0.04]
        "
      />
    );
  }

  if (!userId) {
    return (
      <Link
        href="/auth/login"
        className="
          rounded-lg
          border border-white/15
          px-4 py-2
          text-sm text-white/60
          transition
          hover:border-white/30
          hover:text-white
        "
      >
        Entrar
      </Link>
    );
  }

  const nickname = profile?.nickname?.trim() || "usuário";

  const initial =
    nickname.charAt(0).toUpperCase() || "?";

  return (
    <div
      ref={menuRef}
      className="relative z-[100]"
    >
      {/* BOTÃO DO AVATAR */}
      <button
        type="button"
        aria-label="Abrir menu do usuário"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="
          flex h-10 w-10
          items-center justify-center
          overflow-hidden
          rounded-full
          border border-white/15
          bg-[#f4f1e8]
          text-sm font-semibold
          text-black
          shadow-lg shadow-black/20
          transition
          hover:scale-[1.04]
          hover:border-white/35
        "
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={`Avatar de @${nickname}`}
            className="
              h-full w-full
              object-cover object-center
            "
          />
        ) : (
          initial
        )}
      </button>

      {/* MENU */}
      {open && (
        <div
          className="
            absolute
            right-0 top-[calc(100%+12px)]
            w-[255px]
            overflow-hidden
            rounded-xl
            border border-white/15
            bg-[#121214]
            text-[#f4f1e8]
            shadow-2xl shadow-black/50
          "
        >
          {/* CABEÇALHO */}
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className="
              flex items-center gap-3
              border-b border-white/10
              px-5 py-4
              transition
              hover:bg-white/[0.03]
            "
          >
            <div
              className="
                flex h-10 w-10
                shrink-0
                items-center justify-center
                overflow-hidden
                rounded-full
                border border-white/15
                bg-[#f4f1e8]
                text-sm font-semibold
                text-black
              "
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`Avatar de @${nickname}`}
                  className="
                    h-full w-full
                    object-cover object-center
                  "
                />
              ) : (
                initial
              )}
            </div>

            <div className="min-w-0">
              <p
                className="
                  truncate
                  text-sm font-semibold
                  text-white/90
                "
              >
                @{nickname}
              </p>

              <p
                className="
                  mt-0.5
                  text-xs
                  text-white/30
                "
              >
                Conta CurveOut
              </p>
            </div>
          </Link>

          {/* LINKS */}
          <nav className="py-2">
            <MenuLink
              href="/perfil"
              onClick={() => setOpen(false)}
            >
              Perfil
            </MenuLink>

            <MenuLink
              href="/decks/novo"
              onClick={() => setOpen(false)}
            >
              Criar deck
            </MenuLink>

            <MenuLink
              href="/meus-decks"
              onClick={() => setOpen(false)}
            >
              Meus decks
            </MenuLink>

            <MenuLink
              href="/colecao"
              onClick={() => setOpen(false)}
            >
              Minha coleção
            </MenuLink>

            <MenuLink
              href="/configuracoes"
              onClick={() => setOpen(false)}
            >
              Configurações
            </MenuLink>
          </nav>

          {/* SAIR */}
          <div className="border-t border-white/10 p-2">
            <button
              type="button"
              disabled={signingOut}
              onClick={() => {
                void handleSignOut();
              }}
              className="
                w-full
                rounded-lg
                px-3 py-3
                text-left
                text-sm
                text-red-300/85
                transition
                hover:bg-red-300/[0.06]
                hover:text-red-200
                disabled:cursor-wait
                disabled:opacity-40
              "
            >
              {signingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="
        block w-full
        px-5 py-3
        text-sm
        text-white/65
        transition
        hover:bg-white/[0.045]
        hover:text-white
      "
    >
      {children}
    </Link>
  );
}