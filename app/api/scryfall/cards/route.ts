import { createAdminClient } from "../../../../lib/supabase/admin";

type CardIdentifier = {
  id?: string;
  name?: string;
  set?: string;
  collector_number?: string;
};

type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  requested_name?: string;

  type_line?: string;
  mana_cost?: string;
  oracle_text?: string;
  color_identity?: string[];
  set?: string;
  collector_number?: string;

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
  Accept: "application/json",
  "User-Agent": "CurveOut/0.1",
};

function getCardImages(card: ScryfallCard) {
  return {
    normal:
      card.image_uris?.normal ??
      card.card_faces?.[0]?.image_uris?.normal ??
      null,

    large:
      card.image_uris?.large ??
      card.card_faces?.[0]?.image_uris?.large ??
      null,
  };
}

async function cacheCards(cards: ScryfallCard[]) {
  if (cards.length === 0) {
    return;
  }

  async function getCardsFromCache(
  identifiers: CardIdentifier[]
) {
  const admin = createAdminClient();

  const ids = identifiers
    .map((identifier) => identifier.id)
    .filter((id): id is string => Boolean(id));

  const names = identifiers
    .map((identifier) => identifier.name)
    .filter((name): name is string => Boolean(name));

  const cachedCards: ScryfallCard[] = [];

  if (ids.length > 0) {
    const { data } = await admin
      .from("cards")
      .select("card_data")
      .in("scryfall_id", ids);

    for (const row of data ?? []) {
      cachedCards.push(row.card_data as ScryfallCard);
    }
  }

  if (names.length > 0) {
    const { data } = await admin
      .from("cards")
      .select("card_data")
      .in("name", names);

    for (const row of data ?? []) {
      cachedCards.push(row.card_data as ScryfallCard);
    }
  }

  const uniqueCards = Array.from(
    new Map(
      cachedCards.map((card) => [card.id, card])
    ).values()
  );

  const missingIdentifiers = identifiers.filter(
    (identifier) =>
      !uniqueCards.some((card) => {
        if (identifier.id) {
          return card.id === identifier.id;
        }

        if (!identifier.name) {
          return false;
        }

        const sameName =
          card.name.toLowerCase() ===
          identifier.name.toLowerCase();

        const sameSet =
          !identifier.set ||
          card.set?.toLowerCase() ===
            identifier.set.toLowerCase();

        const sameCollector =
          !identifier.collector_number ||
          card.collector_number ===
            identifier.collector_number;

        return sameName && sameSet && sameCollector;
      })
  );

  return {
    cachedCards: uniqueCards,
    missingIdentifiers,
  };
}

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const cardsToCache = cards.map((card) => {
      const images = getCardImages(card);

      return {
        scryfall_id: card.id,
        oracle_id: card.oracle_id ?? null,
        name: card.name,
        type_line: card.type_line ?? null,
        mana_cost: card.mana_cost ?? null,
        oracle_text: card.oracle_text ?? null,
        color_identity: card.color_identity ?? [],
        image_uri: images.normal,
        image_uri_large: images.large,
        card_data: card,
        cached_at: now,
        updated_at: now,
      };
    });

    const { error } = await admin
      .from("cards")
      .upsert(cardsToCache, {
        onConflict: "scryfall_id",
      });

    if (error) {
      console.error("Erro ao salvar cache:", error);
    }
  } catch (error) {
    console.error("Erro no cache do CurveOut:", error);
  }
}

async function getCardsFromCache(
  identifiers: CardIdentifier[]
) {
  const admin = createAdminClient();

  const ids = identifiers
    .map((identifier) => identifier.id)
    .filter((id): id is string => Boolean(id));

  const names = identifiers
    .map((identifier) => identifier.name)
    .filter((name): name is string => Boolean(name));

  const cachedCards: ScryfallCard[] = [];

  if (ids.length > 0) {
    const { data } = await admin
      .from("cards")
      .select("card_data")
      .in("scryfall_id", ids);

    for (const row of data ?? []) {
      cachedCards.push(row.card_data as ScryfallCard);
    }
  }

  if (names.length > 0) {
    const { data } = await admin
      .from("cards")
      .select("card_data")
      .in("name", names);

    for (const row of data ?? []) {
      cachedCards.push(row.card_data as ScryfallCard);
    }
  }

  const uniqueCards = Array.from(
    new Map(
      cachedCards.map((card) => [card.id, card])
    ).values()
  );

  const missingIdentifiers = identifiers.filter(
    (identifier) =>
      !uniqueCards.some((card) => {
        if (identifier.id) {
          return card.id === identifier.id;
        }

        if (!identifier.name) {
          return false;
        }

        const sameName =
          card.name.toLowerCase() ===
          identifier.name.toLowerCase();

        const sameSet =
          !identifier.set ||
          card.set?.toLowerCase() ===
            identifier.set.toLowerCase();

        const sameCollector =
          !identifier.collector_number ||
          card.collector_number ===
            identifier.collector_number;

        return sameName && sameSet && sameCollector;
      })
  );

  return {
    cachedCards: uniqueCards,
    missingIdentifiers,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const identifiers: CardIdentifier[] =
      Array.isArray(body.identifiers)
        ? body.identifiers
        : [];

    if (identifiers.length === 0) {
      return Response.json({
        cards: [],
        notFound: [],
      });
    }

    const {
  cachedCards,
  missingIdentifiers,
} = await getCardsFromCache(identifiers);

const cards: ScryfallCard[] = [];
const notFound: CardIdentifier[] = [];

for (
  let i = 0;
  i < missingIdentifiers.length;
  i += 75
) {
  const chunk = missingIdentifiers.slice(i, i + 75);

      const response = await fetch(
        "https://api.scryfall.com/cards/collection",
        {
          method: "POST",
          headers: {
            ...scryfallHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identifiers: chunk,
          }),
        }
      );

      if (!response.ok) {
  console.warn(
    `Scryfall indisponível (${response.status}). Usando cache do CurveOut.`
  );

  notFound.push(...chunk);
  continue;
}

      const result: ScryfallCollectionResponse =
        await response.json();

      cards.push(...(result.data ?? []));
      notFound.push(...(result.not_found ?? []));
    }

    const stillNotFound: CardIdentifier[] = [];

    for (const identifier of notFound) {
      if (!identifier.name) {
        stillNotFound.push(identifier);
        continue;
      }

      try {
        const response = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(
            identifier.name
          )}`,
          {
            headers: scryfallHeaders,
          }
        );

        if (!response.ok) {
          stillNotFound.push(identifier);
          continue;
        }

        const card: ScryfallCard = await response.json();

        cards.push({
          ...card,
          requested_name: identifier.name,
        });
      } catch {
        stillNotFound.push(identifier);
      }
    }

    await cacheCards(cards);

return Response.json({
  cards: [...cachedCards, ...cards],
  notFound: stillNotFound,
});

  } catch (error) {
    console.error("Erro em /api/scryfall/cards:", error);

    return Response.json(
      {
        cards: [],
        notFound: [],
        error: "Não foi possível consultar as cartas.",
      },
      {
        status: 500,
      }
    );
  }
}