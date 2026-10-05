"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const formats = [
  "Commander",
  "Standard",
  "Modern",
  "Pioneer",
  "Pauper",
  "Legacy",
  "Vintage",
  "Brawl",
  "Historic",
  "Timeless",
  "Outro",
];

type ScryfallImageUris = {
  small?: string;
  normal?: string;
  large?: string;
};

type ScryfallCardFace = {
  name?: string;
  image_uris?: ScryfallImageUris;
};

type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  requested_name?: string;
  type_line?: string;
  mana_cost?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  lang?: string;
  released_at?: string;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
};

type ScryfallSearchResponse = {
  data?: ScryfallCard[];
  details?: string;
};

type ImportBoard =
  | "mainboard"
  | "commander"
  | "sideboard"
  | "maybeboard";

type ImportedCard = {
  quantity: number;
  name: string;
  board: ImportBoard;
  original: string;
};

function getCardImage(card: ScryfallCard) {
  return (
    card.image_uris?.normal ??
    card.image_uris?.large ??
    card.card_faces?.find((face) => face.image_uris?.normal)?.image_uris
      ?.normal ??
    card.card_faces?.find((face) => face.image_uris?.large)?.image_uris
      ?.large ??
    null
  );
}

function cleanImportedCardName(rawName: string) {
  return rawName
    .replace(/\s+\([A-Z0-9]{2,8}\)\s+\S+\s*$/i, "")
    .replace(/\s+\[[A-Z0-9]{2,8}\]\s*$/i, "")
    .replace(/\s+\([A-Z0-9]{2,8}\)\s*$/i, "")
    .trim();
}

function parseImportedList(value: string): ImportedCard[] {
  const lines = value.split(/\r?\n/);
  const cards: ImportedCard[] = [];