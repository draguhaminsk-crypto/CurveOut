type ScryfallCard = {
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

function getCardImage(card: ScryfallCard) {
  return (
    card.image_uris?.large ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.large ??
    card.card_faces?.[0]?.image_uris?.normal
  );
}

const headers = {
  Accept: "application/json;q=0.9,*/*;q=0.8",
  "User-Agent": "CurveOut/0.1",
};

async function getRandomCommander() {
  const portuguese = await fetch(
    "https://api.scryfall.com/cards/random?q=is%3Acommander+lang%3Apt",
    {
      headers,
      cache: "no-store",
    }
  );

  if (portuguese.ok) {
    return (await portuguese.json()) as ScryfallCard;
  }

  const english = await fetch(
    "https://api.scryfall.com/cards/random?q=is%3Acommander",
    {
      headers,
      cache: "no-store",
    }
  );

  if (!english.ok) {
    throw new Error("Não foi possível carregar um comandante.");
  }

  return (await english.json()) as ScryfallCard;
}

export async function GET() {
  try {
    const commander = await getRandomCommander();

    const currentImage = getCardImage(commander);

    const currentPrint = currentImage
      ? {
          id: commander.id,
          set: commander.set,
          set_name: commander.set_name,
          released_at: commander.released_at,
          image: currentImage,
        }
      : null;

    let prints = currentPrint ? [currentPrint] : [];

    if (commander.prints_search_uri) {
      const response = await fetch(commander.prints_search_uri, {
        headers,
        next: {
          revalidate: 3600,
        },
      });

      if (response.ok) {
        const result = (await response.json()) as {
          data: ScryfallCard[];
        };

        const otherPrints = result.data
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
            (
              print
            ): print is {
              id: string;
              set: string;
              set_name: string;
              released_at: string | undefined;
              image: string;
            } => print !== null
          );

        prints = Array.from(
          new Map(
            [...prints, ...otherPrints].map((print) => [
              print.id,
              print,
            ])
          ).values()
        ).slice(0, 12);
      }
    }

    return Response.json({
      commander,
      prints,
    });
  } catch (error) {
    console.error("Erro no proxy do Scryfall:", error);

    return Response.json(
      {
        error: "Não foi possível acessar o Scryfall.",
      },
      {
        status: 502,
      }
    );
  }
}