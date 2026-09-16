type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  printed_name?: string;
  set: string;
  set_name: string;
  released_at?: string;
  type_line: string;
  printed_type_line?: string;
  oracle_text?: string;
  printed_text?: string;
  image_uris?: {
    normal?: string;
    large?: string;
  };
  card_faces?: Array<{
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
  }>;
};

type CommanderPrint = {
  id: string;
  set: string;
  set_name: string;
  released_at?: string;
  image: string;
};

type ScryfallList = {
  data?: ScryfallCard[];
};

const scryfallHeaders = {
  Accept: "application/json",
  "User-Agent": "CurveOut/1.0",
};

function getCardImage(card: ScryfallCard) {
  return (
    card.image_uris?.large ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.large ??
    card.card_faces?.[0]?.image_uris?.normal ??
    null
  );
}

async function fetchJson<T>(url: string, cache: RequestCache = "no-store") {
  const response = await fetch(url, {
    cache,
    headers: scryfallHeaders,
  });

  if (!response.ok) return null;

  return (await response.json()) as T;
}

export async function GET() {
  try {
    // Escolhemos a carta-base em inglês porque as imagens em inglês sempre têm
    // o scan real da carta. Algumas versões localizadas do Scryfall usam uma
    // imagem de placeholder "Localized Image Not Available".
    const commander = await fetchJson<ScryfallCard>(
      "https://api.scryfall.com/cards/random?q=is%3Acommander+game%3Apaper+lang%3Aen"
    );

    if (!commander) {
      return Response.json(
        { error: "Scryfall indisponível" },
        { status: 502 }
      );
    }

    const oracleId = commander.oracle_id;

    let displayCommander: ScryfallCard = commander;

    // Mantém nome/tipo/texto em português quando houver uma impressão PT,
    // mas preserva a imagem real da carta-base em inglês.
    if (oracleId) {
      const ptQuery = encodeURIComponent(
        `oracleid:${oracleId} lang:pt game:paper`
      );

      const ptResult = await fetchJson<ScryfallList>(
        `https://api.scryfall.com/cards/search?q=${ptQuery}&unique=prints&order=released&dir=desc`
      );

      const translated = ptResult?.data?.[0];

      if (translated) {
        displayCommander = {
          ...commander,
          printed_name:
            translated.printed_name ??
            translated.card_faces?.[0]?.printed_name ??
            commander.printed_name,
          printed_type_line:
            translated.printed_type_line ??
            translated.card_faces?.[0]?.printed_type_line ??
            commander.printed_type_line,
          printed_text:
            translated.printed_text ??
            translated.card_faces?.[0]?.printed_text ??
            commander.printed_text,
        };
      }
    }

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

    let prints: CommanderPrint[] = currentPrint ? [currentPrint] : [];

    if (oracleId) {
      const printQuery = encodeURIComponent(
        `oracleid:${oracleId} lang:en game:paper`
      );

      const printResult = await fetchJson<ScryfallList>(
        `https://api.scryfall.com/cards/search?q=${printQuery}&unique=prints&order=released&dir=desc`
      );

      const otherPrints = (printResult?.data ?? []).flatMap((card) => {
        const cardImage = getCardImage(card);

        if (!cardImage) return [];

        return [
          {
            id: card.id,
            set: card.set,
            set_name: card.set_name,
            released_at: card.released_at,
            image: cardImage,
          } satisfies CommanderPrint,
        ];
      });

      prints = Array.from(
        new Map(
          [
            ...(currentPrint ? [currentPrint] : []),
            ...otherPrints,
          ].map((print) => [print.id, print])
        ).values()
      ).slice(0, 12);
    }

    return Response.json({
      commander: displayCommander,
      prints,
    });
  } catch (error) {
    console.error("Erro ao carregar comandante:", error);

    return Response.json(
      { error: "Não foi possível carregar o comandante." },
      { status: 502 }
    );
  }
}
