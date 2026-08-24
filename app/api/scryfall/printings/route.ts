import { NextRequest, NextResponse } from "next/server";

type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  type_line?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  lang?: string;
  released_at?: string;

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

type ScryfallSearchResponse = {
  data?: ScryfallCard[];
  has_more?: boolean;
  next_page?: string;
  details?: string;
};

const scryfallHeaders = {
  Accept: "application/json",
  "User-Agent": "CurveOut/0.1",
};

export async function GET(request: NextRequest) {
  const oracleId =
    request.nextUrl.searchParams.get("oracle_id")?.trim();

  if (!oracleId) {
    return NextResponse.json(
      {
        error: "oracle_id não informado.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    let nextUrl: string | null =
      `https://api.scryfall.com/cards/search?` +
      new URLSearchParams({
        q: `oracleid:${oracleId}`,
        unique: "prints",
        order: "released",
        dir: "desc",
      }).toString();

    const cards: ScryfallCard[] = [];

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: scryfallHeaders,
        cache: "no-store",
      });

      const result =
        (await response.json()) as ScryfallSearchResponse;

      if (!response.ok) {
        return NextResponse.json(
          {
            error:
              result.details ??
              "Não foi possível buscar as impressões no Scryfall.",
          },
          {
            status: response.status,
          }
        );
      }

      cards.push(...(result.data ?? []));

      nextUrl =
        result.has_more && result.next_page
          ? result.next_page
          : null;
    }

    const printings = cards.map((card) => ({
      scryfall_id: card.id,
      oracle_id: card.oracle_id ?? null,

      name: card.name,
      type_line: card.type_line ?? null,

      image_uri:
        card.image_uris?.normal ??
        card.card_faces?.[0]?.image_uris?.normal ??
        null,

      image_uri_large:
        card.image_uris?.large ??
        card.card_faces?.[0]?.image_uris?.large ??
        null,

      set: card.set?.toUpperCase() ?? "—",
      set_name: card.set_name ?? "Edição desconhecida",

      collector_number:
        card.collector_number ?? "—",

      lang: card.lang?.toUpperCase() ?? "—",

      released_at:
        card.released_at ?? "",
    }));

    return NextResponse.json({
      printings,
    });
  } catch (error) {
    console.error(
      "Erro ao buscar impressões no Scryfall:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível conectar ao Scryfall.",
      },
      {
        status: 502,
      }
    );
  }
}