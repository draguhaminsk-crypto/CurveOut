import { createClient } from "@supabase/supabase-js";
import { gunzipSync } from "node:zlib";

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

const SCRYFALL_HEADERS = {
  Accept: "application/json;q=0.9,*/*;q=0.8",
  "User-Agent": "CurveOut/0.1",
};

const BATCH_SIZE = 100;

function sleep(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

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

function getBulkItems(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.result?.data)) {
    return payload.result.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
}

async function getOracleCardsDownloadUrl() {
  console.log(
    "Buscando lista de Bulk Data do Scryfall..."
  );

  const response = await fetch(
    "https://api.scryfall.com/bulk-data",
    {
      headers: SCRYFALL_HEADERS,
    }
  );

  if (!response.ok) {
    throw new Error(
      `Erro ao consultar Bulk Data: ${response.status}`
    );
  }

  const responseText = await response.text();

  let payload;

  try {
    payload = JSON.parse(responseText);
  } catch {
    console.log(
      "Resposta recebida:",
      responseText.slice(0, 2000)
    );

    throw new Error(
      "Scryfall não retornou JSON válido no Bulk Data."
    );
  }

  const bulkItems = getBulkItems(payload);

  console.log(
    `${bulkItems.length} arquivos Bulk Data encontrados.`
  );

  const oracleBulk = bulkItems.find((item) => {
    const type =
      String(item?.type ?? "")
        .trim()
        .toLowerCase();

    const name =
      String(item?.name ?? "")
        .trim()
        .toLowerCase();

    return (
      type === "oracle_cards" ||
      name === "oracle cards"
    );
  });

  if (!oracleBulk) {
    console.log(
      "Tipos encontrados:",
      bulkItems
        .map((item) => item?.type)
        .filter(Boolean)
        .join(", ")
    );

    console.log(
      "Resposta parcial:",
      JSON.stringify(payload).slice(0, 3000)
    );

    throw new Error(
      "Oracle Cards não foi encontrado na lista de Bulk Data."
    );
  }

  if (!oracleBulk.jsonl_download_uri) {
  console.log(
    "Objeto Oracle Cards recebido:",
    JSON.stringify(oracleBulk, null, 2)
  );

  throw new Error(
    "Oracle Cards foi encontrado, mas não possui jsonl_download_uri."
  );
}

  console.log(
    `Oracle Cards encontrado: ${oracleBulk.name ?? "Oracle Cards"}`
  );

  console.log(
    `Última atualização: ${oracleBulk.updated_at ?? "desconhecida"}`
  );

  return oracleBulk.jsonl_download_uri;
}

async function upsertBatch(
  rows,
  batchNumber
) {
  const MAX_ATTEMPTS = 4;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    const { error } = await supabase
      .from("cards")
      .upsert(rows, {
        onConflict: "scryfall_id",
      });

    if (!error) {
      return;
    }

    console.error(
      `Erro no lote ${batchNumber}, tentativa ${attempt}/${MAX_ATTEMPTS}:`,
      error
    );

    if (attempt === MAX_ATTEMPTS) {
      throw error;
    }

    await sleep(attempt * 1000);
  }
}

async function main() {
  const downloadUrl =
    await getOracleCardsDownloadUrl();

  console.log("");
  console.log(
    "Baixando catálogo Oracle Cards..."
  );

  const cardsResponse = await fetch(
    downloadUrl,
    {
      headers: SCRYFALL_HEADERS,
    }
  );

  if (!cardsResponse.ok) {
    throw new Error(
      `Erro ao baixar Oracle Cards: ${cardsResponse.status}`
    );
  }

 const compressedBuffer = Buffer.from(
  await cardsResponse.arrayBuffer()
);

console.log(
  `Arquivo baixado: ${(compressedBuffer.length / 1024 / 1024).toFixed(1)} MB compactados.`
);

const decompressedBuffer =
  gunzipSync(compressedBuffer);

const jsonLines =
  decompressedBuffer.toString("utf8");

const cards = jsonLines
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line));

  console.log(
    `${cards.length} cartas recebidas do Scryfall.`
  );

  const validCards = cards.filter(
    (card) =>
      card &&
      typeof card === "object" &&
      card.id &&
      card.name
  );

  console.log(
    `${validCards.length} cartas válidas serão sincronizadas.`
  );

  console.log("");

  let saved = 0;
  let batchNumber = 0;

  for (
    let index = 0;
    index < validCards.length;
    index += BATCH_SIZE
  ) {
    batchNumber++;

    const batch = validCards.slice(
      index,
      index + BATCH_SIZE
    );

    const now =
      new Date().toISOString();

    const rows = batch.map((card) => {
      const images =
        getImages(card);

      return {
        scryfall_id:
          card.id,

        oracle_id:
          card.oracle_id ?? null,

        name:
          card.name,

        type_line:
          card.type_line ?? null,

        mana_cost:
          card.mana_cost ?? null,

        oracle_text:
          card.oracle_text ?? null,

        color_identity:
          card.color_identity ?? [],

        image_uri:
          images.normal,

        image_uri_large:
          images.large,

        card_data:
          card,

        cached_at:
          now,

        updated_at:
          now,
      };
    });

    await upsertBatch(
      rows,
      batchNumber
    );

    saved += batch.length;

    console.log(
      `Salvas ${saved}/${validCards.length}`
    );

    await sleep(100);
  }

  console.log("");
  console.log(
    "=============================="
  );

  console.log(
    "Sincronização concluída."
  );

  console.log(
    `${saved} cartas salvas no CurveOut.`
  );

  console.log(
    "=============================="
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "Falha na sincronização:"
  );

  console.error(error);

  process.exit(1);
});