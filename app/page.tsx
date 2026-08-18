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

const scryfallHeaders = {
  Accept: "application/json;q=0.9,*/*;q=0.8",
  "User-Agent": "CurveOut/0.1",
};

function getCardImage(card: Commander) {
  return (
    card.image_uris?.large ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.large ??
    card.card_faces?.[0]?.image_uris?.normal
  );
}

async function getRandomCommander(): Promise<Commander | null> {
  try {
    // Primeiro tenta pegar um comandante com impressão em português.
    const ptResponse = await fetch(
      "https://api.scryfall.com/cards/random?q=is%3Acommander+lang%3Apt",
      {
        cache: "no-store",
        headers: scryfallHeaders,
      }
    );

    if (ptResponse.ok) {
      return ptResponse.json();
    }

    // Se falhar, usa qualquer comandante.
    const enResponse = await fetch(
      "https://api.scryfall.com/cards/random?q=is%3Acommander",
      {
        cache: "no-store",
        headers: scryfallHeaders,
      }
    );

    if (!enResponse.ok) {
      return null;
    }

    return enResponse.json();
  } catch {
    return null;
  }
}

async function getCommanderPrints(
  commander: Commander
): Promise<CommanderPrint[]> {
  const currentImage = getCardImage(commander);

  const currentPrint: CommanderPrint | null = currentImage
    ? {
        id: commander.id,
        set: commander.set,
        set_name: commander.set_name,
        released_at: commander.released_at,
        image: currentImage,
      }
    : null;

  if (!commander.prints_search_uri) {
    return currentPrint ? [currentPrint] : [];
  }

  try {
    const response = await fetch(commander.prints_search_uri, {
      headers: scryfallHeaders,
      next: {
        revalidate: 3600,
      },
    });

    if (!response.ok) {
      return currentPrint ? [currentPrint] : [];
    }

    const result: {
      data: Commander[];
    } = await response.json();

    const otherPrints: CommanderPrint[] = result.data
      .map((card) => {
        const image = getCardImage(card);

        if (!image) {
          return null;
        }

        return {
          id: card.id,
          set: card.set,
          set_name: card.set_name,
          released_at: card.released_at,
          image,
        };
      })
      .filter(
        (print): print is CommanderPrint =>
          print !== null
      );

    const allPrints = currentPrint
      ? [currentPrint, ...otherPrints]
      : otherPrints;

    // Remove duplicatas.
    const uniquePrints = Array.from(
      new Map(
        allPrints.map((print) => [print.id, print])
      ).values()
    );

    // Evita dezenas de cartas no carrossel.
    return uniquePrints.slice(0, 12);
  } catch {
    return currentPrint ? [currentPrint] : [];
  }
}

export default async function Home() {
  const commander = await getRandomCommander();

  const commanderPrints = commander
    ? await getCommanderPrints(commander)
    : [];

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
      <header className="flex h-20 items-center justify-between border-b border-white/10 px-6 md:px-10">
        <a
          href="/"
          className={`${cinzel.className} text-2xl font-bold uppercase tracking-[0.015em]`}
        >
          CurveOut
        </a>

        <nav className="hidden items-center gap-8 text-sm text-white/65 md:flex">
          <a href="#" className="transition hover:text-white">
            Decks
          </a>

          <a href="#" className="transition hover:text-white">
            Cartas
          </a>

          <a href="#" className="transition hover:text-white">
            Coleções
          </a>

          <a href="#" className="transition hover:text-white">
            Explorar
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <button className="hidden px-4 py-2 text-sm text-white/70 transition hover:text-white sm:block">
            Entrar
          </button>

          <button className="rounded-lg bg-[#f4f1e8] px-4 py-2 text-sm font-semibold text-black transition hover:bg-white">
            Criar conta
          </button>
        </div>
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
              <div className="grid items-center gap-12 lg:grid-cols-[430px_1fr]">
                {/* CARTA / CARROSSEL */}
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

                {/* INFORMAÇÕES */}
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
                    <button className="rounded-lg bg-[#f4f1e8] px-6 py-3 font-semibold text-black transition hover:bg-white">
                      Criar deck com este comandante
                    </button>

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
    </div>
  );
}