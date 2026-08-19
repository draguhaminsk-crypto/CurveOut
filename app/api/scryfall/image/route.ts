const scryfallHeaders = {
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "User-Agent": "CurveOut/0.1",
};

const allowedImageHosts = new Set([
  "cards.scryfall.io",
]);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const imageUrl = requestUrl.searchParams.get("url");

  if (!imageUrl) {
    return new Response("URL da imagem não informada.", {
      status: 400,
    });
  }

  let target: URL;

  try {
    target = new URL(imageUrl);
  } catch {
    return new Response("URL da imagem inválida.", {
      status: 400,
    });
  }

  if (
    target.protocol !== "https:" ||
    !allowedImageHosts.has(target.hostname)
  ) {
    return new Response("Domínio de imagem não permitido.", {
      status: 403,
    });
  }

  try {
    const response = await fetch(target.toString(), {
      headers: scryfallHeaders,
      next: {
        revalidate: 86400,
      },
    });

    if (!response.ok || !response.body) {
      return new Response("Não foi possível carregar a imagem.", {
        status: response.status || 502,
      });
    }

    const contentType =
      response.headers.get("content-type") ?? "image/jpeg";

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Erro no proxy de imagem do Scryfall:", error);

    return new Response("Não foi possível carregar a imagem.", {
      status: 502,
    });
  }
}