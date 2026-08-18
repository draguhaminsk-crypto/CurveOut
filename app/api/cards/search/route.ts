import { NextRequest, NextResponse } from "next/server";

const scryfallHeaders = {
  Accept: "application/json;q=0.9,*/*;q=0.8",
  "User-Agent": "CurveOut/0.1",
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Digite o nome de uma carta." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(
        query
      )}&unique=prints&order=released`,
      {
        headers: scryfallHeaders,
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: data?.details ?? "Não foi possível buscar as cartas.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro ao consultar Scryfall:", error);

    return NextResponse.json(
      { error: "Erro ao conectar com o Scryfall." },
      { status: 500 }
    );
  }
}