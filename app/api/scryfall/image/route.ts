import { NextRequest } from "next/server";

const allowedHosts = new Set(["cards.scryfall.io"]);

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return new Response("URL ausente", { status: 400 });

  let target: URL;
  try { target = new URL(raw); } catch { return new Response("URL inválida", { status: 400 }); }
  if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) {
    return new Response("Host não permitido", { status: 400 });
  }

  try {
    const response = await fetch(target.toString(), {
      headers: { "User-Agent": "CurveOut/1.0", Accept: "image/*" },
      next: { revalidate: 86400 },
    });
    if (!response.ok || !response.body) return new Response("Imagem indisponível", { status: 502 });
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("Erro no proxy de imagem:", error);
    return new Response("Imagem indisponível", { status: 502 });
  }
}
