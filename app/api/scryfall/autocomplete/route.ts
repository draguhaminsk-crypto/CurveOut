import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function GET(request: NextRequest) {
  const query =
    request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({
      data: [],
    });
  }

  try {
    const supabase = createAdminClient();

    const { data: startsWith, error: startsWithError } =
      await supabase
        .from("cards")
        .select("name")
        .ilike("name", `${query}%`)
        .order("name")
        .limit(10);

    if (startsWithError) {
      throw startsWithError;
    }

    let names = (startsWith ?? []).map(
      (card) => card.name
    );

    if (names.length < 10) {
      const { data: contains, error: containsError } =
        await supabase
          .from("cards")
          .select("name")
          .ilike("name", `%${query}%`)
          .order("name")
          .limit(20);

      if (containsError) {
        throw containsError;
      }

      names = [
        ...names,
        ...(contains ?? []).map(
          (card) => card.name
        ),
      ];
    }

    const uniqueNames = Array.from(
      new Set(names)
    ).slice(0, 10);

    return NextResponse.json({
      data: uniqueNames,
    });
  } catch (error) {
    console.error(
      "Erro ao buscar cartas no banco do CurveOut:",
      error
    );

    return NextResponse.json(
      {
        data: [],
        error:
          "Não foi possível pesquisar as cartas.",
      },
      {
        status: 500,
      }
    );
  }
}