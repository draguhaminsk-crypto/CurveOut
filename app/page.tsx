import { Cinzel } from "next/font/google";

const cinzel = Cinzel({
  subsets: ["latin"],
  display: "swap",
});

type Commander = {
  name: string;
  type_line: string;
  oracle_text?: string;
  image_uris?: {
    normal?: string;
    large?: string;
  };
  card_faces?: {
    image_uris?: {
      normal?: string;
      large?: string;
    };
  }[];
};

async function getRandomCommander(): Promise<Commander | null> {
  try {
    const response = await fetch(
      "https://api.scryfall.com/cards/random?q=is%3Acommander",
      {
        cache: "no-store",
        headers: {
          Accept: "application/json;q=0.9,*/*;q=0.8",
          "User-Agent": "CurveOut/0.1",
        },
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
  const commander = await getRandomCommander();

const commanderImage =
  commander?.image_uris?.large ??
  commander?.image_uris?.normal ??
  commander?.card_faces?.[0]?.image_uris?.large ??
  commander?.card_faces?.[0]?.image_uris?.normal;

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-[#f4f1e8]">
      <header className="flex h-20 items-center justify-between border-b border-white/10 px-6 md:px-10">
        <a
          href="/"
          className={`${cinzel.className} text-2xl font-bold uppercase tracking-[-0.04em]`}
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
        <section className="relative flex min-h-[calc(100vh-80px)] items-center justify-center overflow-hidden px-6 md:px-10">
  <div
    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
    style={{
      backgroundImage: "url('/hero-bg.jpg')",
    }}
  />

  <div className="absolute inset-0 bg-black/55" />

  <div className="relative z-10 flex w-full max-w-7xl flex-col items-center text-center">
    <h1
      className={`${cinzel.className} text-[16vw] font-bold uppercase leading-[0.78] tracking-[-0.055em] md:text-[12vw]`}
    >
      <span>CURVE</span>

    <span className="text-white/35">
    <span
  className="inline-block"
  style={{
    transform: "skewX(-12deg)",
    transformOrigin: "center",
  }}
>
  O
</span>
    <span>UT</span>
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

        <section className="border-t border-white/10 px-6 py-20 md:px-10">
  <div className="mb-10">
    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/35">
      Descobrir
    </p>

    <h2
      className={`${cinzel.className} text-3xl font-semibold tracking-tight md:text-4xl`}
    >
      Comandante em destaque
    </h2>
  </div>

  {commander ? (
    <div className="grid items-center gap-10 md:grid-cols-[320px_1fr]">
      <div>
        {commanderImage && (
          <img
            src={commanderImage}
            alt={commander.name}
            className="w-full rounded-2xl"
          />
        )}
      </div>

      <div className="max-w-2xl">
        <p className="mb-3 text-sm uppercase tracking-[0.15em] text-white/35">
          {commander.type_line}
        </p>

        <h3
          className={`${cinzel.className} mb-6 text-4xl font-bold md:text-6xl`}
        >
          {commander.name}
        </h3>

        {commander.oracle_text && (
          <p className="whitespace-pre-line text-base leading-8 text-white/55">
            {commander.oracle_text}
          </p>
        )}

        <button className="mt-8 rounded-lg border border-white/15 px-6 py-3 font-medium text-white/75 transition hover:border-white/30 hover:text-white">
          Ver comandante
        </button>
      </div>
    </div>
  ) : (
    <p className="text-white/45">
      Não foi possível carregar o comandante agora.
    </p>
  )}
</section>

      </main>
    </div>
  );
}