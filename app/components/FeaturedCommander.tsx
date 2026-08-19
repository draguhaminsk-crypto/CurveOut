"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";

import CommanderPrintCarousel from "./CommanderPrintCarousel";

type CommanderPrint = {
  id: string;
  set: string;
  set_name: string;
  released_at?: string;
  image: string;
};

type Commander = {
  id: string;

  name: string;
  printed_name?: string;

  set: string;
  set_name: string;
  released_at?: string;

  type_line: string;
  printed_type_line?: string;

  oracle_text?: string;
  printed_text?: string;

  image_uris?: {
    normal?: string;
    large?: string;
  };

  card_faces?: {
    name?: string;
    printed_name?: string;

    oracle_text?: string;
    printed_text?: string;

    type_line?: string;
    printed_type_line?: string;

    image_uris?: {
      normal?: string;
      large?: string;
    };
  }[];
};

type CommanderResponse = {
  commander: Commander;
  prints: CommanderPrint[];
};

type FeaturedCommanderProps = {
  cinzelClassName: string;
};

const proxyUrl = "/api/scryfall/commander";

function getCardImage(card: Commander) {
  return (
    card.image_uris?.large ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.large ??
    card.card_faces?.[0]?.image_uris?.normal
  );
}

export default function FeaturedCommander({
  cinzelClassName,
}: FeaturedCommanderProps) {
  const [data, setData] = useState<CommanderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCommander() {
      try {
        setLoading(true);
        setFailed(false);

        const response = await fetch(proxyUrl, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Proxy respondeu com ${response.status}.`
          );
        }

        const result =
          (await response.json()) as CommanderResponse;

        setData(result);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Erro ao carregar comandante pelo proxy:",
          error
        );

        setFailed(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadCommander();

    return () => {
      controller.abort();
    };
  }, []);

  const commander = data?.commander ?? null;
  const commanderPrints = data?.prints ?? [];

  const commanderName =
    commander?.printed_name ??
    commander?.card_faces?.[0]?.printed_name ??
    commander?.name ??
    "Comandante";

  const commanderType =
    commander?.printed_type_line ??
    commander?.card_faces?.[0]?.printed_type_line ??
    commander?.type_line ??
    "";

  const commanderText =
    commander?.printed_text ??
    commander?.card_faces?.[0]?.printed_text ??
    commander?.oracle_text ??
    commander?.card_faces?.[0]?.oracle_text ??
    "";

  const commanderImage = commander
    ? getCardImage(commander)
    : undefined;

  const ligaMagicUrl = commander
    ? `https://www.ligamagic.com.br/?view=cards%2Fsearch&card=${encodeURIComponent(
        commander.name
      )}`
    : "#";

  return (
    <section className="border-t border-white/10 px-6 py-20 md:px-10 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/35">
            Descobrir
          </p>

          <h2
            className={`${cinzelClassName} text-3xl font-semibold tracking-tight md:text-5xl`}
          >
            Comandante em destaque
          </h2>
        </div>

        {loading ? (
          <div className="grid animate-pulse items-center gap-12 lg:grid-cols-[520px_1fr]">
            <div className="mx-auto aspect-[0.716] w-full max-w-[340px] rounded-2xl bg-white/[0.04]" />

            <div>
              <div className="h-4 w-52 rounded bg-white/[0.05]" />
              <div className="mt-6 h-12 max-w-xl rounded bg-white/[0.05]" />
              <div className="mt-7 h-32 max-w-2xl rounded bg-white/[0.03]" />
            </div>
          </div>
        ) : failed || !commander ? (
          <div>
            <p className="text-white/45">
              Não foi possível carregar o comandante agora.
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 text-sm text-white/55 underline underline-offset-4 transition hover:text-white"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="grid items-center gap-12 lg:grid-cols-[520px_1fr]">
            <div className="min-w-0">
              {commanderPrints.length > 1 ? (
                <CommanderPrintCarousel
                  prints={commanderPrints}
                  alt={commanderName}
                />
              ) : commanderImage ? (
                <img
                  src={commanderImage}
                  alt={commanderName}
                  className="mx-auto w-full max-w-[340px] rounded-2xl shadow-2xl"
                />
              ) : (
                <div className="mx-auto aspect-[0.716] w-full max-w-[340px] rounded-2xl border border-white/10 bg-white/[0.03]" />
              )}
            </div>

            <div className="max-w-3xl">
              <p className="mb-4 text-sm uppercase tracking-[0.14em] text-white/35">
                {commanderType}
              </p>

              <h3
                className={`${cinzelClassName} mb-6 text-4xl font-bold leading-tight md:text-6xl`}
              >
                {commanderName}
              </h3>

              {commanderText && (
                <p className="max-w-2xl whitespace-pre-line text-base leading-8 text-white/55 md:text-lg">
                  {commanderText}
                </p>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                <button className="rounded-lg bg-[#f4f1e8] px-6 py-3 font-semibold text-black transition hover:bg-white">
                  Criar deck com este comandante
                </button>

                <a
                  href={ligaMagicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-white/15 px-6 py-3 font-medium text-white/75 transition hover:border-white/30 hover:text-white"
                >
                  Ver preços na LigaMagic ↗
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}