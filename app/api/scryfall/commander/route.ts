type ScryfallCard = {
  id: string;
  name: string;
  printed_name?: string;
  set: string;
  set_name: string;
  released_at?: string;
  prints_search_uri?: string;
  type_line: string;
  printed_type_line?: string;
  oracle_text?: string;
  printed_text?: string;
  image_uris?: { normal?: string; large?: string };
  card_faces?: Array<{
    name?: string;
    printed_name?: string;
    oracle_text?: string;
    printed_text?: string;
    type_line?: string;
    printed_type_line?: string;
    image_uris?: { normal?: string; large?: string };
  }>;
};

type CommanderPrint = { id: string; set: string; set_name: string; released_at?: string; image: string };
const headers = { Accept: "application/json", "User-Agent": "CurveOut/1.0" };
function image(card: ScryfallCard) { return card.image_uris?.large ?? card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.large ?? card.card_faces?.[0]?.image_uris?.normal; }

export async function GET() {
  try {
    let response = await fetch("https://api.scryfall.com/cards/random?q=is%3Acommander+game%3Apaper+lang%3Apt", { cache: "no-store", headers });
    if (!response.ok) response = await fetch("https://api.scryfall.com/cards/random?q=is%3Acommander+game%3Apaper", { cache: "no-store", headers });
    if (!response.ok) return Response.json({ error: "Scryfall indisponível" }, { status: 502 });
    const commander = (await response.json()) as ScryfallCard;
    const currentImage = image(commander);
    const current: CommanderPrint[] = currentImage ? [{ id: commander.id, set: commander.set, set_name: commander.set_name, released_at: commander.released_at, image: currentImage }] : [];
    let prints = current;
    if (commander.prints_search_uri) {
      const printResponse = await fetch(commander.prints_search_uri, { headers, next: { revalidate: 3600 } });
      if (printResponse.ok) {
        const result = (await printResponse.json()) as { data?: ScryfallCard[] };
        const others = (result.data ?? []).flatMap((card) => {
          const cardImage = image(card);
          return cardImage ? [{ id: card.id, set: card.set, set_name: card.set_name, released_at: card.released_at, image: cardImage }] : [];
        });
        prints = Array.from(new Map([...current, ...others].map((p) => [p.id, p])).values()).slice(0, 12);
      }
    }
    return Response.json({ commander, prints });
  } catch (error) {
    console.error("Erro ao carregar comandante:", error);
    return Response.json({ error: "Não foi possível carregar o comandante." }, { status: 502 });
  }
}
