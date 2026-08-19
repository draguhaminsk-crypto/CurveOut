import { Cinzel } from "next/font/google";

import FeaturedCommander from "./components/FeaturedCommander";
import UserMenu from "./components/UserMenu";

const cinzel = Cinzel({
  subsets: ["latin"],
  display: "swap",
});

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0b0b0d] text-[#f4f1e8]">
      <header className="flex h-20 items-center justify-between border-b border-white/10 px-6 md:px-10">
        <a
          href="/"
          className={`${cinzel.className} text-2xl font-bold uppercase tracking-[0.015em]`}
        >
          CurveOut
        </a>

        <nav className="hidden items-center gap-8 text-sm text-white/65 md:flex">
          <a
            href="/decks"
            className="transition hover:text-white"
          >
            Decks
          </a>

          <a
            href="/cartas"
            className="transition hover:text-white"
          >
            Cartas
          </a>

          <a
            href="/colecoes"
            className="transition hover:text-white"
          >
            Coleções
          </a>

          <a
            href="/explorar"
            className="transition hover:text-white"
          >
            Explorar
          </a>
        </nav>

        <UserMenu />
      </header>

      <main>
        {/* HERO */}
        <section className="relative flex min-h-[calc(100vh-80px)] items-center justify-center overflow-hidden px-6 md:px-10">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
            style={{
              backgroundImage: "url('/hero-bg.jpg')",
            }}
          />

          <div className="absolute inset-0 bg-black/60" />

          <div className="relative z-10 flex w-full max-w-[1500px] flex-col items-center text-center">
            <h1
              className={`${cinzel.className} flex items-end whitespace-nowrap text-[13vw] font-bold uppercase leading-none tracking-[0.01em] md:text-[10.2vw]`}
            >
              <span>CURVE</span>

              <span className="ml-[0.005em] text-white/35">
                <span
                  className="inline-block"
                  style={{
                    transform: "skewX(-10deg)",
                    transformOrigin: "center",
                  }}
                >
                  O
                </span>
                UT
              </span>
            </h1>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <button className="rounded-lg bg-[#f4f1e8] px-6 py-3 font-semibold text-black transition hover:bg-white">
                Criar meu deck
              </button>

              <button className="rounded-lg border border-white/15 px-6 py-3 font-medium text-white/75 transition hover:border-white/30 hover:text-white">
                Explorar decks
              </button>
            </div>
          </div>
        </section>

        {/* COMANDANTE EM DESTAQUE */}
        <FeaturedCommander cinzelClassName={cinzel.className} />
      </main>

      <footer className="border-t border-white/10 px-6 py-12 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-start">
            <div>
              <a
                href="/"
                className={`${cinzel.className} text-2xl font-bold uppercase tracking-[0.015em]`}
              >
                CurveOut
              </a>

              <p className="mt-3 max-w-sm text-sm leading-6 text-white/40">
                Construa, ajuste e compartilhe seus decks.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/25">
                  Navegar
                </p>

                <div className="flex flex-col gap-2.5 text-white/50">
                  <a href="/decks" className="transition hover:text-white">
                    Decks
                  </a>
                  <a href="/cartas" className="transition hover:text-white">
                    Cartas
                  </a>
                  <a href="/colecoes" className="transition hover:text-white">
                    Coleções
                  </a>
                  <a href="/explorar" className="transition hover:text-white">
                    Explorar
                  </a>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/25">
                  Conta
                </p>

                <div className="flex flex-col gap-2.5 text-white/50">
                  <a href="/perfil" className="transition hover:text-white">
                    Perfil
                  </a>
                  <a href="/meus-decks" className="transition hover:text-white">
                    Meus decks
                  </a>
                  <a href="/decks/novo" className="transition hover:text-white">
                    Criar deck
                  </a>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/25">
                  CurveOut
                </p>

                <div className="flex flex-col gap-2.5 text-white/50">
                  <a
                    href="mailto:curveoutcg@gmail.com"
                    className="transition hover:text-white"
                  >
                    Contato
                  </a>
                  <a href="/termos" className="transition hover:text-white">
                    Termos
                  </a>
                  <a href="/privacidade" className="transition hover:text-white">
                    Privacidade
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs leading-5 text-white/25 md:flex-row md:items-end md:justify-between">
            <p>© 2026 CurveOut.</p>

            <p className="max-w-2xl md:text-right">
              Magic: The Gathering e suas marcas relacionadas pertencem à
              Wizards of the Coast. CurveOut é um projeto independente e não é
              afiliado, endossado ou patrocinado pela Wizards of the Coast.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}