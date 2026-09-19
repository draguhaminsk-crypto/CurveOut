import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ScryfallImageUris = {
  normal?: string;
  large?: string;
};

type ScryfallCardFace = {
  image_uris?: ScryfallImageUris;
};

type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  type_line?: string;
  set: string;
  set_name: string;
  collector_number: string;
  lang: string;
  released_at: string;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
};

type ScryfallSearchResponse = {
  data?: ScryfallCard[];
  has_more?: boolean;
  next_page?: string;
  details?: string;
};

type CardPrinting = {
  scryfall_id: string;
  oracle_id: string | null;
  name: string;
  type_line: string | null;
  image_uri: string | null;
  image_uri_large: string | null;
  set: string;
  set_name: string;
  collector_number: string;
  lang: string;
  released_at: string;
};

const scryfallHeaders = {
  Accept: "application/json",
  "User-Agent": "CurveOut/0.1",
};

function getImages(card: ScryfallCard) {
  return {
    normal:
      card.image_uris?.normal ??
      card.card_faces?.find((face) => face.image_uris?.normal)?.image_uris
        ?.normal ??
      null,
    large:
      card.image_uris?.large ??
      card.card_faces?.find((face) => face.image_uris?.large)?.image_uris
        ?.large ??
      null,
  };
}


function toPrinting(card: ScryfallCard): CardPrinting {
  const images = getImages(card);

  return {
    scryfall_id: card.id,
    oracle_id: card.oracle_id ?? null,
    name: card.name,
    type_line: card.type_line ?? null,
    image_uri: images.normal,
    image_uri_large: images.large,
    set: card.set?.toUpperCase() ?? "",
    set_name: card.set_name ?? "Edição desconhecida",
    collector_number: card.collector_number ?? "",
    lang: card.lang?.toUpperCase() ?? "EN",
    released_at: card.released_at ?? "",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const oracleId = searchParams.get("oracle_id")?.trim();

  if (!oracleId) {
    return NextResponse.json(
      { error: "oracle_id é obrigatório." },
      { status: 400 }
    );
  }

  try {
    const query = `oracleid:${oracleId} game:paper`;
    let nextUrl: string | null =
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}` +
      `&unique=prints&order=released&dir=desc` +
      `&include_variations=true`;

    const allCards: ScryfallCard[] = [];
    let pageCount = 0;

    while (nextUrl && pageCount < 10) {
      const response = await fetch(nextUrl, {
        headers: scryfallHeaders,
        cache: "no-store",
      });

      const result = (await response.json()) as ScryfallSearchResponse;

      if (!response.ok) {
        return NextResponse.json(
          {
            error:
              result.details ??
              `Não foi possível consultar as impressões no Scryfall (${response.status}).`,
          },
          { status: response.status === 404 ? 404 : 502 }
        );
      }

      allCards.push(...(result.data ?? []));
      nextUrl = result.has_more && result.next_page ? result.next_page : null;
      pageCount += 1;
    }

    const unique = Array.from(
      new Map(allCards.map((card) => [card.id, card])).values()
    );

    const printings = unique
      .map(toPrinting)
      .filter((printing) => Boolean(printing.image_uri || printing.image_uri_large));

    return NextResponse.json(
      { printings },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Erro ao carregar impressões no Scryfall:", error);

    return NextResponse.json(
      { error: "Não foi possível carregar as impressões desta carta." },
      { status: 502 }
    );
  }
}
