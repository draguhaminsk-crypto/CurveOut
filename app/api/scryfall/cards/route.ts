type CardIdentifier = {
  id?: string;
  name?: string;
};

type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  requested_name?: string;
  type_line?: string;
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

type ScryfallCollectionResponse = {
  data?: ScryfallCard[];
  not_found?: CardIdentifier[];
};

const scryfallHeaders = {
  Accept: "application/json;q=0.9,*/*;q=0.8",
  "Content-Type": "application/json",
  "User-Agent": "CurveOut/0.1",
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeIdentifiers(value: unknown): CardIdentifier[] {
  if (!Array.isArray(value)) return [];

  const identifiers: CardIdentifier[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const raw = item as CardIdentifier;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";

    if (!id && !name) continue;

    const key = id ? `id:${id}` : `name:${name.toLocaleLowerCase("en-US")}`;

    if (seen.has(key)) continue;
    seen.add(key);

    identifiers.push(id ? { id } : { name });
  }

  return identifiers.slice(0, 300);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      identifiers?: unknown;
    };

    const identifiers = normalizeIdentifiers(body.identifiers);

    if (identifiers.length === 0) {
      return Response.json(
        { error: "Nenhuma carta informada." },
        { status: 400 }
      );
    }

    const cards: ScryfallCard[] = [];
    const notFound: CardIdentifier[] = [];

    // O endpoint /cards/collection aceita no máximo 75 identificadores por chamada.
    for (let index = 0; index < identifiers.length; index += 75) {
      const chunk = identifiers.slice(index, index + 75);

      if (index > 0) {
        await wait(550);
      }

      const response = await fetch(
        "https://api.scryfall.com/cards/collection",
        {
          method: "POST",
          headers: scryfallHeaders,
          body: JSON.stringify({
            identifiers: chunk,
          }),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const details = await response.text().catch(() => "");

        console.error(
          "Scryfall collection error:",
          response.status,
          details
        );

        return Response.json(
          {
            error: `O Scryfall respondeu com ${response.status}.`,
          },
          { status: 502 }
        );
      }

      const result = (await response.json()) as ScryfallCollectionResponse;

      cards.push(...(result.data ?? []));

      const chunkNotFound = result.not_found ?? [];

      // Alguns cards especiais/dupla-face são registrados pelo Scryfall
      // com o nome completo, por exemplo:
      // "Grave Researcher // Reanimate".
      //
      // O endpoint /cards/collection pode não resolver quando a lista
      // importada traz apenas o nome da face ("Grave Researcher").
      // Para esses casos, tentamos uma segunda busca pelo endpoint /cards/named.
      for (const missing of chunkNotFound) {
        const missingName =
          typeof missing.name === "string" ? missing.name.trim() : "";

        if (!missingName) {
          notFound.push(missing);
          continue;
        }

        await wait(120);

        const namedResponse = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(
            missingName
          )}`,
          {
            headers: {
              Accept: "application/json;q=0.9,*/*;q=0.8",
              "User-Agent": "CurveOut/0.1",
            },
            cache: "no-store",
          }
        );

        if (!namedResponse.ok) {
          notFound.push(missing);
          continue;
        }

        const namedCard = (await namedResponse.json()) as ScryfallCard;

        cards.push({
          ...namedCard,
          requested_name: missingName,
        });
      }
    }

    return Response.json({
      cards,
      notFound,
    });
  } catch (error) {
    console.error("Erro ao consultar cartas no Scryfall:", error);

    return Response.json(
      {
        error: "Não foi possível consultar as cartas no Scryfall.",
      },
      { status: 502 }
    );
  }
}