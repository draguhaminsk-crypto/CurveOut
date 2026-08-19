import { NextRequest, NextResponse } from "next/server";

type ScryfallCard = {
  id: string;
  name: string;
};

type ScryfallSearchResponse = {
  object?: string;
  data?: ScryfallCard[];
  details?: string;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({
      data: [],
    });
  }

  try {
    const safeQuery = escapeRegex(query);

    // Busca pelo trecho em qualquer parte do nome.
    // Ex.: "grave" também encontra "Grave Researcher // Reanimate".
    const scryfallQuery = `name:/${safeQuery}/i`;

    const response = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(
        scryfallQuery
      )}&unique=cards&order=name`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "CurveOut/0.1",
        },
        cache: "no-store",
      }
    );

    // O Scryfall devolve 404 quando nenhuma carta bate com a busca.
    if (response.status === 404) {
      return NextResponse.json({
        data: [],
      });
    }

    const result = (await response.json()) as ScryfallSearchResponse;

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            result.details ??
            "Não foi possível pesquisar as cartas no Scryfall.",
          data: [],
        },
        {
          status: response.status,
        }
      );
    }

    const names = Array.from(
      new Set((result.data ?? []).map((card) => card.name))
    ).slice(0, 15);

    return NextResponse.json({
      data: names,
    });
  } catch (error) {
    console.error("Erro na pesquisa de cartas do Scryfall:", error);

    return NextResponse.json(
      {
        error: "Não foi possível consultar o Scryfall.",
        data: [],
      },
      {
        status: 500,
      }
    );
  }
}