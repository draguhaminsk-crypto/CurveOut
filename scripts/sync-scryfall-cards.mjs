import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY não configurada."
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function getImages(card) {
  return {
    normal:
      card.image_uris?.normal ??
      card.card_faces?.[0]?.image_uris?.normal ??
      null,

    large:
      card.image_uris?.large ??
      card.card_faces?.[0]?.image_uris?.large ??
      null,
  };
}

console.log("Buscando informações do Bulk Data...");

const bulkResponse = await fetch(
  "https://api.scryfall.com/bulk-data/oracle_cards",
  {
    headers: {
      Accept: "application/json;q=0.9,*/*;q=0.8",
      "User-Agent": "CurveOut/0.1",
    },
  }
);

if (!bulkResponse.ok) {
  throw new Error(
    `Erro ao consultar Oracle Cards: ${bulkResponse.status}`
  );
}

const oracleBulk = await bulkResponse.json();

if (!oracleBulk?.download_uri) {
  throw new Error(
    "download_uri do Oracle Cards não encontrado."
  );
}

console.log("Baixando catálogo de cartas...");

const cardsResponse = await fetch(
  oracleBulk.download_uri,
  {
    headers: {
      "User-Agent": "CurveOut/0.1",
    },
  }
);

if (!cardsResponse.ok) {
  throw new Error(
    `Erro ao baixar cartas: ${cardsResponse.status}`
  );
}

const cards = await cardsResponse.json();

console.log(
  `${cards.length} cartas recebidas do Scryfall.`
);

const BATCH_SIZE = 250;

for (
  let index = 0;
  index < cards.length;
  index += BATCH_SIZE
) {
  const batch = cards.slice(
    index,
    index + BATCH_SIZE
  );

  const now = new Date().toISOString();

  const rows = batch.map((card) => {
    const images = getImages(card);

    return {
      scryfall_id: card.id,
      oracle_id: card.oracle_id ?? null,
      name: card.name,
      type_line: card.type_line ?? null,
      mana_cost: card.mana_cost ?? null,
      oracle_text: card.oracle_text ?? null,
      color_identity: card.color_identity ?? [],
      image_uri: images.normal,
      image_uri_large: images.large,
      card_data: card,
      cached_at: now,
      updated_at: now,
    };
  });

  const { error } = await supabase
    .from("cards")
    .upsert(rows, {
      onConflict: "scryfall_id",
    });

  if (error) {
    console.error(
      `Erro no lote ${index}-${index + batch.length}:`,
      error
    );

    throw error;
  }

  console.log(
    `Salvas ${Math.min(
      index + batch.length,
      cards.length
    )}/${cards.length}`
  );
}

console.log("Sincronização concluída.");