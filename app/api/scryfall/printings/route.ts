import { NextRequest } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type CardData = Record<string, unknown>;
function str(value: unknown) { return typeof value === "string" ? value : ""; }

export async function GET(request: NextRequest) {
  const oracleId = request.nextUrl.searchParams.get("oracle_id")?.trim();
  if (!oracleId) return Response.json({ error: "oracle_id é obrigatório." }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("cards")
      .select("scryfall_id, oracle_id, name, type_line, image_uri, image_uri_large, card_data")
      .eq("oracle_id", oracleId);
    if (error) throw error;

    const printings = (data ?? []).map((row) => {
      const cardData = row.card_data && typeof row.card_data === "object" && !Array.isArray(row.card_data) ? (row.card_data as CardData) : {};
      return {
        scryfall_id: row.scryfall_id,
        oracle_id: row.oracle_id,
        name: row.name,
        type_line: row.type_line,
        image_uri: row.image_uri,
        image_uri_large: row.image_uri_large,
        set: str(cardData.set).toUpperCase(),
        set_name: str(cardData.set_name) || "Edição desconhecida",
        collector_number: str(cardData.collector_number) || "—",
        lang: (str(cardData.lang) || "en").toUpperCase(),
        released_at: str(cardData.released_at),
      };
    }).sort((a, b) => b.released_at.localeCompare(a.released_at));

    return Response.json({ printings });
  } catch (error) {
    console.error("Erro ao carregar impressões:", error);
    return Response.json({ error: "Não foi possível carregar as impressões." }, { status: 500 });
  }
}
