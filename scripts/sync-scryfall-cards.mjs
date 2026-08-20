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

const scryfallHeaders = {
  Accept: "application/json",
  "User-Agent": "CurveOut/0.1",
};

const BATCH_SIZE = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function findOracleBulkItem(payload) {
  const possibleLists = [
    Array.isArray(payload)
      ? payload
      : [],

    Array.isArray(payload?.data)
      ? payload.data
      : [],

    Array.isArray(payload?.result?.data)
      ? payload.result.data
      : [],

    Array.isArray(payload?.bulkData)
      ? payload.bulkData
      : [],
  ];

  for (const list of possibleLists) {
    const item = list.find(
      (entry) =>
        entry?.type === "oracle_cards" ||
        entry?.name === "Oracle Cards"
    );

    if (item?.download_uri) {
      return item;
    }
  }

  return null;
}

function findDirectBulkItem(payload) {
  const possibilities = [
    payload,
    payload?.data,
    payload?.result,
    payload?.bulkData,
  ];

  for (const item of possibilities) {
    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      item.download_uri
    ) {
      return item;
    }
  }

  return null;
}

async function getOracleCardsDownloadUrl() {
  console.log(
    "Buscando informações do Bulk Data..."
  );

  /*
    Tentativa 1:
    pega a lista completa de Bulk Data e procura
    pelo tipo oracle_cards.
  */
  try {
    const response = await fetch(
      "https://api.scryfall.com/bulk-data",
      {
        headers: scryfallHeaders,
      }
    );

    if (response.ok) {
      const payload = await response.json();

      const oracleBulk =
        findOracleBulkItem(payload);

      if (oracleBulk?.download_uri) {
        console.log(
          "Oracle Cards encontrado pela lista de Bulk Data."
        );

        return oracleBulk.download_uri;
      }

      console.warn(
        "A lista de Bulk Data respondeu, mas oracle_cards não foi encontrado no formato esperado."
      );
    } else {
      console.warn(
        `Lista de Bulk Data respondeu com ${response.status}.`
      );
    }
  } catch (error) {
    console.warn(
      "Falha ao consultar lista de Bulk Data:",
      error
    );
  }

  /*
    Tentativa 2:
    consulta diretamente o Bulk Data pelo tipo.
  */
  try {
    console.log(
      "Tentando consultar Oracle Cards diretamente..."
    );

    const response = await fetch(
      "https://api.scryfall.com/bulk-data/oracle_cards",
      {
        headers: scryfallHeaders,
      }
    );

    if (response.ok) {
      const payload = await response.json();

      const oracleBulk =
        findDirectBulkItem(payload);

      if (oracleBulk?.download_uri) {
        console.log(
          "Oracle Cards encontrado pela consulta direta."
        );

        return oracleBulk.download_uri;
      }

      console.warn(
        "Consulta direta respondeu, mas download_uri não foi encontrado."
      );
    } else {
      console.warn(
        `Consulta direta respondeu com ${response.status}.`
      );
    }
  } catch (error) {
    console.warn(
      "Falha na consulta direta de Oracle Cards:",
      error
    );
  }

  /*
    Último fallback.

    Esse endereço aponta para o arquivo atual
    de Oracle Cards no host de dados do Scryfall.
  */
  console.warn(
    "Usando URL de fallback do Oracle Cards."
  );

  return "https://data.scryfall.io/oracle-cards/oracle-cards.json";
}

async function upsertBatch(rows, batchNumber) {
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

const downloadUrl =
  await getOracleCardsDownloadUrl();

console.log(
  "Baixando catálogo Oracle Cards..."
);

const cardsResponse = await fetch(
  downloadUrl,
  {
    headers: {
      Accept: "application/json",
      "User-Agent": "CurveOut/0.1",
    },
  }
);

if (!cardsResponse.ok) {
  throw new Error(
    `Erro ao baixar Oracle Cards: ${cardsResponse.status}`
  );
}

const cards = await cardsResponse.json();

if (!Array.isArray(cards)) {
  throw new Error(
    "O arquivo Oracle Cards não retornou uma lista de cartas."
  );
}

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

      color_identity:
        card.color_identity ?? [],

      image_uri: images.normal,
      image_uri_large: images.large,

      card_data: card,

      cached_at: now,
      updated_at: now,
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

  /*
    Pequena pausa para não bombardear
    o Supabase com requisições consecutivas.
  */
  await sleep(100);
}

console.log("");
console.log("==============================");
console.log("Sincronização concluída.");
console.log(
  `${saved} cartas salvas no CurveOut.`
);
console.log("==============================");