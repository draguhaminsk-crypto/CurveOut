export default function Home() {
  return (
    <div className="min-h-screen bg-[#0b0b0d] text-[#f4f1e8]">
      <header className="flex h-20 items-center justify-between border-b border-white/10 px-6 md:px-10">
        <a
          href="/"
          className="text-2xl font-bold uppercase tracking-[-0.04em]"
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
        <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-6 md:px-10">
          <div className="flex w-full max-w-7xl flex-col items-center text-center">
            <h1 className="text-[16vw] font-black uppercase leading-[0.82] tracking-[-0.07em] md:text-[12vw]">
              CURVE
              <span className="text-white/35">OUT</span>
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
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/35">
                Descobrir
              </p>

              <h2 className="text-3xl font-semibold tracking-tight">
                Decks em destaque
              </h2>
            </div>

            <button className="text-sm text-white/50 transition hover:text-white">
              Ver todos →
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Commander", "Atraxa, Grand Unifier", "5 cores"],
              ["Modern", "Boros Energy", "Boros"],
              ["Commander", "Muldrotha, the Gravetide", "Sultai"],
            ].map(([format, name, colors]) => (
              <article
                key={name}
                className="group flex min-h-64 cursor-pointer flex-col justify-between rounded-xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-white/20 hover:bg-white/[0.045]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.15em] text-white/35">
                    {format}
                  </span>

                  <span className="text-xs text-white/35">{colors}</span>
                </div>

                <div>
                  <h3 className="mb-2 text-2xl font-semibold tracking-tight">
                    {name}
                  </h3>

                  <p className="text-sm text-white/35">
                    Ver deck{" "}
                    <span className="transition group-hover:ml-1">→</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}