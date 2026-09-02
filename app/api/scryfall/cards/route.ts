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
    name?: string;
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

type CardRow = Record<string, unknown>;

const scryfallHeaders = {
  Accept: "application/json",
  "User-Agent": "CurveOut/0.1",
};


function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function cardRowToScryfallCard(row: CardRow): ScryfallCard {
  const rawCardData = row.card_data;

  if (
    rawCardData &&
    typeof rawCardData === "object" &&
    !Array.isArray(rawCardData)
  ) {
    const cardData = rawCardData as Partial<ScryfallCard>;

    if (
      typeof cardData.id === "string" &&
      typeof cardData.name === "string"
    ) {
      return cardData as ScryfallCard;
    }
  }

  const id = getString(row.scryfall_id) ?? getString(row.id) ?? "";
  const name = getString(row.name) ?? `Carta ${id.slice(0, 8)}`;
  const normalImage =
    getString(row.image_uri) ?? getString(row.image_uri_normal);
  const largeImage = getString(row.image_uri_large);

  return {
    id,
    oracle_id: getString(row.oracle_id),
    name,
    type_line: getString(row.type_line),
    mana_cost: getString(row.mana_cost),
    oracle_text: getString(row.oracle_text),
    color_identity: getStringArray(row.color_identity),
    set: getString(row.set),
    collector_number: getString(row.collector_number),
    image_uris:
      normalImage || largeImage
        ? {
            normal: normalImage,
            large: largeImage,
          }
        : undefined,
  };
}

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
  if (cards.length === 0) return;

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

function normalizeCardName(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function cardMatchesIdentifier(card: ScryfallCard, identifier: CardIdentifier) {
  if (identifier.id) {
    return card.id === identifier.id;
  }

  if (!identifier.name) return false;

  const requestedName = normalizeCardName(identifier.name);
  const fullName = normalizeCardName(card.name);

  const faceNames = [
    ...card.name.split(" // "),
    ...(card.card_faces ?? [])
      .map((face) => face.name)
      .filter((name): name is string => Boolean(name)),
  ].map(normalizeCardName);

  const sameName =
    fullName === requestedName || faceNames.includes(requestedName);

  const sameSet =
    !identifier.set ||
    card.set?.toLocaleLowerCase("en-US") ===
      identifier.set.toLocaleLowerCase("en-US");

  const sameCollector =
    !identifier.collector_number ||
    card.collector_number === identifier.collector_number;

  return sameName && sameSet && sameCollector;
}

function withRequestedName(
  card: ScryfallCard,
  identifier: CardIdentifier
): ScryfallCard {
  if (!identifier.name) return card;

  return {
    ...card,
    requested_name: identifier.name,
  };
}

async function getCardsFromCache(identifiers: CardIdentifier[]) {
  const admin = createAdminClient();

  const ids = identifiers
    .map((identifier) => identifier.id)
    .filter((id): id is string => Boolean(id));

  const names = identifiers
    .map((identifier) => identifier.name)
    .filter((name): name is string => Boolean(name));

  const cachedCards: ScryfallCard[] = [];

  if (ids.length > 0) {
    const { data, error } = await admin
      .from("cards")
      .select("*")
      .in("scryfall_id", ids);

    if (error) throw error;

    for (const row of data ?? []) {
      const card = cardRowToScryfallCard(row as CardRow);
      const identifier = identifiers.find((item) =>
        cardMatchesIdentifier(card, item)
      );

      if (card.id) {
        cachedCards.push(
          identifier ? withRequestedName(card, identifier) : card
        );
      }
    }
  }

  // Primeiro tenta nomes completos/exatos, que é o caminho mais rápido.
  if (names.length > 0) {
    const { data, error } = await admin
      .from("cards")
      .select("*")
      .in("name", names);

    if (error) throw error;

    for (const row of data ?? []) {
      const card = cardRowToScryfallCard(row as CardRow);
      const identifier = identifiers.find((item) =>
        cardMatchesIdentifier(card, item)
      );

      if (card.id) {
        cachedCards.push(
          identifier ? withRequestedName(card, identifier) : card
        );
      }
    }
  }

  // MDFCs, Adventures e outras cartas de duas faces ficam salvas como:
  // "Boggart Trawler // Boggart Bog".
  // Uma decklist normalmente traz somente "Boggart Trawler". Então, para
  // os nomes que ainda não bateram, procuramos a face da frente OU a de trás
  // diretamente no espelho local do CurveOut, sem depender do Scryfall.
  const unresolvedNameIdentifiers = identifiers.filter(
    (identifier) =>
      Boolean(identifier.name) &&
      !cachedCards.some((card) => cardMatchesIdentifier(card, identifier))
  );

  for (const identifier of unresolvedNameIdentifiers) {
    const requestedName = identifier.name?.trim();
    if (!requestedName) continue;

    const candidates: CardRow[] = [];

    const { data: frontRows, error: frontError } = await admin
      .from("cards")
      .select("*")
      .ilike("name", `${requestedName} // %`)
      .limit(10);

    if (frontError) throw frontError;
    candidates.push(...((frontRows ?? []) as CardRow[]));

    const { data: backRows, error: backError } = await admin
      .from("cards")
      .select("*")
      .ilike("name", `% // ${requestedName}`)
      .limit(10);

    if (backError) throw backError;
    candidates.push(...((backRows ?? []) as CardRow[]));

    for (const row of candidates) {
      const card = cardRowToScryfallCard(row);

      if (!card.id || !cardMatchesIdentifier(card, identifier)) {
        continue;
      }

      cachedCards.push(withRequestedName(card, identifier));
      break;
    }
  }

  // Mantemos uma entrada por combinação "carta + nome solicitado". Isso é
  // importante para o import conseguir relacionar "Pinnacle Monk" com a
  // carta cujo nome completo é "Pinnacle Monk // Mystic Peak".
  const uniqueCards = Array.from(
    new Map(
      cachedCards.map((card) => [
        `${card.id}:${normalizeCardName(card.requested_name ?? card.name)}`,
        card,
      ])
    ).values()
  );

  const missingIdentifiers = identifiers.filter(
    (identifier) =>
      !uniqueCards.some((card) => cardMatchesIdentifier(card, identifier))
  );

  return {
    cachedCards: uniqueCards,
    missingIdentifiers,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const identifiers: CardIdentifier[] = Array.isArray(body.identifiers)
      ? body.identifiers
      : [];

    if (identifiers.length === 0) {
      return Response.json({
        cards: [],
        notFound: [],
      });
    }

    const { cachedCards, missingIdentifiers } =
      await getCardsFromCache(identifiers);

    const cards: ScryfallCard[] = [];
    const notFound: CardIdentifier[] = [];

    for (let i = 0; i < missingIdentifiers.length; i += 75) {
      const chunk = missingIdentifiers.slice(i, i + 75);

      try {
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

        const result: ScryfallCollectionResponse = await response.json();

        const resolvedChunkCards = (result.data ?? []).map((card) => {
          const identifier = chunk.find((item) =>
            cardMatchesIdentifier(card, item)
          );

          return identifier ? withRequestedName(card, identifier) : card;
        });

        cards.push(...resolvedChunkCards);
        notFound.push(...(result.not_found ?? []));
      } catch (error) {
        console.warn(
          "Não foi possível consultar a coleção no Scryfall:",
          error
        );
        notFound.push(...chunk);
      }
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name");

  if (!name) {
    return Response.json(
      {
        error: "Informe o nome da carta.",
      },
      {
        status: 400,
      }
    );
  }

  const fakePostRequest = new Request(request.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifiers: [{ name }],
    }),
  });

  return POST(fakePostRequest);
}
