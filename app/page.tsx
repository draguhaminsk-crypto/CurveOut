import Link from "next/link";
import { Cinzel } from "next/font/google";

import CommanderPrintCarousel from "./components/CommanderPrintCarousel";
import type { CommanderPrint } from "./components/CommanderPrintCarousel";

const cinzel = Cinzel({
  subsets: ["latin"],
  display: "swap",
});

type Commander = {
  id: string;

  name: string;
  printed_name?: string;

  set: string;
  set_name: string;
  released_at?: string;

  prints_search_uri?: string;

  type_line: string;
  printed_type_line?: string;

  oracle_text?: string;
  printed_text?: string;

  image_uris?: {
    normal?: string;
    large?: string;
  };

  card_faces?: {
    name?: string;
    printed_name?: string;

    oracle_text?: string;
    printed_text?: string;

    type_line?: string;
    printed_type_line?: string;

    image_uris?: {
      normal?: string;
      large?: string;
    };
  }[];
};

function getCardImage(card: Commander) {
  return (
    card.image_uris?.large ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.large ??
    card.card_faces?.[0]?.image_uris?.normal
  );
}

type CommanderProxyResponse = {
  commander: Commander;
  prints: CommanderPrint[];
};

async function getCommanderData(): Promise<CommanderProxyResponse | null> {
  try {
    const response = await fetch(
      "https://curveout.com.br/api/scryfall/commander",
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const commanderData = await getCommanderData();

  const commander = commanderData?.commander ?? null;
  const commanderPrints = commanderData?.prints ?? [];

  const commanderName =
    commander?.printed_name ??
    commander?.card_faces?.[0]?.printed_name ??
    commander?.name ??
    "Comandante";

  const commanderType =
    commander?.printed_type_line ??
    commander?.card_faces?.[0]?.printed_type_line ??
    commander?.type_line ??
    "";

  const commanderText =
    commander?.printed_text ??
    commander?.card_faces?.[0]?.printed_text ??
    commander?.oracle_text ??
    commander?.card_faces?.[0]?.oracle_text ??
    "";

  const commanderImage = commander
    ? getCardImage(commander)
    : undefined;

  const ligaMagicUrl = commander
    ? `https://www.ligamagic.com.br/?view=cards%2Fsearch&card=${encodeURIComponent(
        commander.name
      )}`
    : "#";

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-[#f4f1e8]">
      <header className="relative flex h-20 items-center border-b border-white/10 px-6 md:px-10">
        <Link
          href="/"
          className={`${cinzel.className} text-2xl font-bold uppercase tracking-[0.015em]`}
        >
          CurveOut
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm text-white/65 md:flex">
          <Link
            href="/decks"
            className="transition hover:text-white"
          >
            Decks
          </Link>

          <Link
            href="/cartas"
            className="transition hover:text-white"
          >
            Cartas
          </Link>

          <Link
            href="/colecao"
            className="transition hover:text-white"
          >
            Coleções
          </Link>

          <Link
            href="/usuarios"
            className="transition hover:text-white"
          >
            Explorar
          </Link>
        </nav>

        <Link
          href="/auth/login"
          className="ml-auto rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-white/25 hover:text-white"
        >
          Entrar
        </Link>
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
              <Link
                href="/decks/novo"
                className="rounded-lg bg-[#f4f1e8] px-6 py-3 font-semibold text-black transition hover:bg-white"
              >
                Criar meu deck
              </Link>

              <Link
                href="/decks"
                className="rounded-lg border border-white/15 px-6 py-3 font-medium text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Explorar decks
              </Link>
            </div>
          </div>
        </section>

        {/* COMANDANTE EM DESTAQUE */}
        <section className="border-t border-white/10 px-6 py-20 md:px-10 md:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12">
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/35">
                Descobrir
              </p>

              <h2
                className={`${cinzel.className} text-3xl font-semibold tracking-tight md:text-5xl`}
              >
                Comandante em destaque
              </h2>
            </div>

            {commander ? (
              <div className="grid items-center gap-12 lg:grid-cols-[520px_1fr]">
                <div className="min-w-0">
                  {commanderPrints.length > 1 ? (
                    <CommanderPrintCarousel
                      prints={commanderPrints}
                      alt={commanderName}
                    />
                  ) : commanderImage ? (
                    <img
                      src={commanderImage}
                      alt={commanderName}
                      className="mx-auto w-full max-w-[340px] rounded-2xl shadow-2xl"
                    />
                  ) : (
                    <div className="mx-auto aspect-[0.716] w-full max-w-[340px] rounded-2xl border border-white/10 bg-white/[0.03]" />
                  )}
                </div>

                <div className="max-w-3xl">
                  <p className="mb-4 text-sm uppercase tracking-[0.14em] text-white/35">
                    {commanderType}
                  </p>

                  <h3
                    className={`${cinzel.className} mb-6 text-4xl font-bold leading-tight md:text-6xl`}
                  >
                    {commanderName}
                  </h3>

                  {commanderText && (
                    <p className="max-w-2xl whitespace-pre-line text-base leading-8 text-white/55 md:text-lg">
                      {commanderText}
                    </p>
                  )}

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href={`/decks/novo?commander=${encodeURIComponent(
                        commander.id
                      )}`}
                      className="rounded-lg bg-[#f4f1e8] px-6 py-3 font-semibold text-black transition hover:bg-white"
                    >
                      Criar deck com este comandante
                    </Link>

                    <a
                      href={ligaMagicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-white/15 px-6 py-3 font-medium text-white/75 transition hover:border-white/30 hover:text-white"
                    >
                      Ver preços na LigaMagic ↗
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-white/45">
                Não foi possível carregar o comandante agora.
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-12 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-start">
            <div>
              <Link
                href="/"
                className={`${cinzel.className} text-2xl font-bold uppercase tracking-[0.015em]`}
              >
                CurveOut
              </Link>

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
                  <Link href="/decks" className="transition hover:text-white">
                    Decks
                  </Link>
                  <Link href="/cartas" className="transition hover:text-white">
                    Cartas
                  </Link>
                  <Link href="/colecao" className="transition hover:text-white">
                    Coleções
                  </Link>
                  <Link href="/usuarios" className="transition hover:text-white">
                    Explorar
                  </Link>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/25">
                  Conta
                </p>

                <div className="flex flex-col gap-2.5 text-white/50">
                  <Link href="/perfil" className="transition hover:text-white">
                    Perfil
                  </Link>
                  <Link href="/meus-decks" className="transition hover:text-white">
                    Meus decks
                  </Link>
                  <Link href="/decks/novo" className="transition hover:text-white">
                    Criar deck
                  </Link>
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
                  <Link href="/termos" className="transition hover:text-white">
                    Termos
                  </Link>
                  <Link href="/privacidade" className="transition hover:text-white">
                    Privacidade
                  </Link>
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
