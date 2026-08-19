import Link from "next/link";

export type DeckCardData = {
  id: string;
  name: string;
  format: string;
  is_public: boolean;
  description: string | null;
  commander_scryfall_id: string | null;
  created_at: string;
  updated_at: string;
};

type DeckCardProps = {
  deck: DeckCardData;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function truncateText(text: string, maxLength = 140) {
  const cleanText = text.trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  return `${cleanText.slice(0, maxLength).trimEnd()}...`;
}

export default function DeckCard({ deck }: DeckCardProps) {
  return (
    <Link
      href={`/decks/${deck.id}`}
      className="
        group
        overflow-hidden
        rounded-2xl
        border border-white/10
        bg-white/[0.02]
        transition
        hover:-translate-y-0.5
        hover:border-white/25
        hover:bg-white/[0.04]
      "
    >
      {/* CAPA / ARTE DO DECK */}
      <div className="relative h-40 overflow-hidden border-b border-white/10">
        <div
          className="
            absolute inset-0
            scale-105
            bg-cover bg-center
            opacity-55
            transition duration-500
            group-hover:scale-110
            group-hover:opacity-65
          "
          style={{
            backgroundImage: "url('/hero-bg.jpg')",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-[#0b0b0d]/45 to-black/10" />

        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
            {deck.commander_scryfall_id
              ? "Arte do comandante em breve"
              : "Sem comandante definido"}
          </p>

          <span
            className={`
              rounded-full
              border px-2.5 py-1
              text-[11px]
              ${
                deck.is_public
                  ? "border-white/10 bg-black/25 text-white/50"
                  : "border-white/10 bg-black/35 text-white/40"
              }
            `}
          >
            {deck.is_public ? "Público" : "Privado"}
          </span>
        </div>
      </div>

      <div className="flex min-h-[230px] flex-col justify-between p-5">
        <div>
          <div className="flex items-start justify-between gap-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/30">
            {deck.format}
          </p>

        </div>

        <h2
          className="
            mt-4
            break-words
            text-2xl font-semibold
            text-[#f4f1e8]
            transition
            group-hover:text-white
          "
        >
          {deck.name}
        </h2>

        <p className="mt-3 break-words text-sm leading-6 text-white/35">
          {deck.description
            ? truncateText(deck.description)
            : "Sem notas adicionadas."}
        </p>
      </div>

        <div className="mt-8 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/20">
              Atualizado
            </p>

            <p className="mt-1 text-xs text-white/35">
              {formatDate(deck.updated_at)}
            </p>
          </div>

          <span className="text-sm text-white/35 transition group-hover:text-white/70">
            Abrir deck →
          </span>
        </div>
      </div>
    </Link>
  );
}