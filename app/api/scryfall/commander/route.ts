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

const scryfallHeaders = {
  Accept: "application/json;q=0.9,*/*;q=0.8",
  "User-Agent": "CurveOut/0.1",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function getCardImage(card: ScryfallCard) {
  return (
    card.image_uris?.large ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.large ??
    card.card_faces?.[0]?.image_uris?.normal
  );
}

function proxiedImageUrl(imageUrl: string | undefined) {
  if (!imageUrl) return undefined;

  return `/api/scryfall/image?url=${encodeURIComponent(imageUrl)}`;
}

function proxifyCard(card: ScryfallCard): ScryfallCard {
  return {
    ...card,

    image_uris: card.image_uris
      ? {
          normal: proxiedImageUrl(card.image_uris.normal),
          large: proxiedImageUrl(card.image_uris.large),
        }
      : undefined,

    card_faces: card.card_faces?.map((face) => ({
      ...face,
      image_uris: face.image_uris
        ? {
            normal: proxiedImageUrl(face.image_uris.normal),
            large: proxiedImageUrl(face.image_uris.large),
          }
        : undefined,
    })),
  };
}

async function getRandomCommander(): Promise<ScryfallCard> {
  const portuguese = await fetch(
    "https://api.scryfall.com/cards/random?q=is%3Acommander+lang%3Apt",
    {
      headers: scryfallHeaders,
      next: {
        revalidate: 600,
      },
    }
  );

  if (portuguese.ok) {
    return portuguese.json();
  }

  const english = await fetch(
    "https://api.scryfall.com/cards/random?q=is%3Acommander",
    {
      headers: scryfallHeaders,
      next: {
        revalidate: 600,
      },
    }
  );

  if (!english.ok) {
    throw new Error(`Scryfall respondeu com ${english.status}.`);
  }

  return english.json();
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET() {
  try {
    const rawCommander = await getRandomCommander();
    const commander = proxifyCard(rawCommander);

    const currentRawImage = getCardImage(rawCommander);

    const currentPrint = currentRawImage
      ? {
          id: rawCommander.id,
          set: rawCommander.set,
          set_name: rawCommander.set_name,
          released_at: rawCommander.released_at,
          image: proxiedImageUrl(currentRawImage)!,
        }
      : null;

    let prints = currentPrint ? [currentPrint] : [];

    if (rawCommander.prints_search_uri) {
      const response = await fetch(rawCommander.prints_search_uri, {
        headers: scryfallHeaders,
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
              image: proxiedImageUrl(image)!,
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

    return Response.json(
      {
        commander,
        prints,
      },
      {
        headers: {
          ...corsHeaders,
          "Cache-Control": "public, max-age=60, s-maxage=600",
        },
      }
    );
  } catch (error) {
    console.error("Erro no proxy do Scryfall:", error);

    return Response.json(
      {
        error: "Não foi possível acessar o Scryfall.",
      },
      {
        status: 502,
        headers: corsHeaders,
      }
    );
  }
}