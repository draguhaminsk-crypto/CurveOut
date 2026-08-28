import { NextResponse } from "next/server";

export const revalidate = 3600;

type FrankfurterResponse = {
  date?: string;
  base?: string;
  rates?: {
    BRL?: number;
  };
};

export async function GET() {
  try {
    const response = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL",
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Não foi possível consultar a cotação USD/BRL." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as FrankfurterResponse;
    const rate = data.rates?.BRL;

    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        { error: "A cotação USD/BRL retornou um valor inválido." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      rate,
      date: data.date ?? null,
      source: "Frankfurter",
    });
  } catch (error) {
    console.error("Erro ao consultar USD/BRL:", error);

    return NextResponse.json(
      { error: "Não foi possível consultar a cotação USD/BRL." },
      { status: 500 }
    );
  }
}
