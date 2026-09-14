import { NextRequest } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ data: [] });
  try {
    const admin = createAdminClient();
    const escaped = q.replaceAll("%", "\\%").replaceAll("_", "\\_");
    const { data: starts, error: e1 } = await admin.from("cards").select("name").ilike("name", `${escaped}%`).order("name").limit(10);
    if (e1) throw e1;
    const names = new Map<string, string>();
    for (const row of starts ?? []) if (typeof row.name === "string") names.set(row.name.toLowerCase(), row.name);
    if (names.size < 10) {
      const { data: contains, error: e2 } = await admin.from("cards").select("name").ilike("name", `%${escaped}%`).order("name").limit(20);
      if (e2) throw e2;
      for (const row of contains ?? []) if (typeof row.name === "string") names.set(row.name.toLowerCase(), row.name);
    }
    return Response.json({ data: Array.from(names.values()).slice(0, 10) });
  } catch (error) {
    console.error("Erro no autocomplete:", error);
    return Response.json({ data: [] }, { status: 500 });
  }
}
