import { createAdminClient } from "../../../../lib/supabase/admin";

type CardIdentifier = {
  id?: string;
  name?: string;
  set?: string;
  collector_number?: string;
};

type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  requested_name?: string;
  type_line?: string;
  mana_cost?: string;
  oracle_text?: string;
  color_identity?: string[];
  set?: string;
  collector_number?: string;
  image_uris?: {
    normal?: string;
    large?: string;
  };
  card_faces?: {
    name?: string;
    image_uris?: {
      normal?: string;
      large?: string;
    };
  }[];
};

type ScryfallCollectionResponse = {
  data?: ScryfallCard[];
  not_found?: CardIdentifier[];
};

type CardRow = Record<string, unknown>;

const scryfallHeaders = {
  Accept: "application/json",
  "User-Agent": "CurveOut/0.1",
};


function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function cardRowToScryfallCard(row: CardRow): ScryfallCard {
  const rawCardData = row.card_data;

  if (
    rawCardData &&
    typeof rawCardData === "object" &&
    !Array.isArray(rawCardData)
  ) {
    const cardData = rawCardData as Partial<ScryfallCard>;

    if (
      typeof cardData.id === "string" &&
      typeof cardData.name === "string"
    ) {
      return cardData as ScryfallCard;
    }
  }

  const id = getString(row.scryfall_id) ?? getString(row.id) ?? "";
  const name = getString(row.name) ?? `Carta ${id.slice(0, 8)}`;
  const normalImage =
    getString(row.image_uri) ?? getString(row.image_uri_normal);
  const largeImage = getString(row.image_uri_large);

  return {
    id,
    oracle_id: getString(row.oracle_id),
    name,
    type_line: getString(row.type_line),
    mana_cost: getString(row.mana_cost),
    oracle_text: getString(row.oracle_text),
    color_identity: getStringArray(row.color_identity),
    set: getString(row.set),
    collector_number: getString(row.collector_number),
    image_uris:
      normalImage || largeImage
        ? {
            normal: normalImage,
            large: largeImage,
          }
        : undefined,