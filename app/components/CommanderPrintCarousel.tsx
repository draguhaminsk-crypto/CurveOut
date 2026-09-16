"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";

export type CommanderPrint = {
  id: string;
  set: string;
  set_name: string;
  released_at?: string;
  image: string;
};

type Props = {
  prints: CommanderPrint[];
  alt: string;
};

export default function CommanderPrintCarousel({ prints, alt }: Props) {
  const safePrints = useMemo(
    () => Array.from(new Map(prints.map((print) => [print.id, print])).values()),
    [prints]
  );

  const [index, setIndex] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const dragged = useRef(false);

  if (safePrints.length === 0) return null;

  const currentIndex = Math.min(index, safePrints.length - 1);
  const current = safePrints[currentIndex];

  function move(direction: -1 | 1) {
    setIndex((value) => {
      const normalized = Math.min(value, safePrints.length - 1);
      const next = normalized + direction;

      if (next < 0) return safePrints.length - 1;
      if (next >= safePrints.length) return 0;

      return next;
    });
  }

  return (
    <div className="mx-auto w-full max-w-[520px] select-none">
      <div
        className="relative mx-auto w-full max-w-[420px] touch-pan-y cursor-grab active:cursor-grabbing"
        onPointerDown={(event) => {
          dragStartX.current = event.clientX;
          dragged.current = false;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragStartX.current === null) return;

          if (Math.abs(event.clientX - dragStartX.current) > 8) {
            dragged.current = true;
          }
        }}
        onPointerUp={(event) => {
          if (dragStartX.current === null) return;

          const delta = event.clientX - dragStartX.current;
          dragStartX.current = null;

          if (Math.abs(delta) < 45) return;

          move(delta > 0 ? -1 : 1);
        }}
        onPointerCancel={() => {
          dragStartX.current = null;
          dragged.current = false;
        }}
      >
        <div className="relative mx-auto w-full max-w-[340px]">
          <img
            key={current.id}
            src={current.image}
            alt={`${alt} — ${current.set_name}`}
            draggable={false}
            className="w-full rounded-2xl shadow-2xl shadow-black/45"
          />
        </div>

        {safePrints.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Impressão anterior"
              onClick={(event) => {
                event.stopPropagation();
                move(-1);
              }}
              className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/75 text-2xl text-white/75 shadow-lg backdrop-blur transition hover:border-white/35 hover:bg-black/90 hover:text-white"
            >
              ‹
            </button>

            <button
              type="button"
              aria-label="Próxima impressão"
              onClick={(event) => {
                event.stopPropagation();
                move(1);
              }}
              className="absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/75 text-2xl text-white/75 shadow-lg backdrop-blur transition hover:border-white/35 hover:bg-black/90 hover:text-white"
            >
              ›
            </button>
          </>
        )}
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs font-medium text-white/55">
          {current.set_name}
          {current.set ? ` · ${current.set.toUpperCase()}` : ""}
        </p>

        {current.released_at && (
          <p className="mt-1 text-[11px] text-white/25">
            {new Intl.DateTimeFormat("pt-BR", {
              year: "numeric",
              month: "short",
            }).format(new Date(`${current.released_at}T00:00:00`))}
          </p>
        )}
      </div>

      {safePrints.length > 1 && (
        <div className="mt-5 overflow-x-auto pb-2 [scrollbar-width:thin]">
          <div className="mx-auto flex w-max min-w-full items-center justify-center gap-2.5 px-1">
            {safePrints.map((print, printIndex) => (
              <button
                key={print.id}
                type="button"
                title={`${print.set_name} (${print.set.toUpperCase()})`}
                aria-label={`Usar impressão ${print.set_name}`}
                onClick={() => {
                  if (dragged.current) {
                    dragged.current = false;
                    return;
                  }

                  setIndex(printIndex);
                }}
                className={`relative h-[92px] w-[66px] shrink-0 overflow-hidden rounded-lg border transition duration-150 ${
                  printIndex === currentIndex
                    ? "border-white/65 opacity-100 ring-2 ring-white/20"
                    : "border-white/10 opacity-45 hover:border-white/30 hover:opacity-80"
                }`}
              >
                <img
                  src={print.image}
                  alt={`${alt} — ${print.set_name}`}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {safePrints.length > 1 && (
        <p className="mt-1 text-center text-[10px] uppercase tracking-[0.14em] text-white/20">
          Arraste a carta, use as setas ou escolha uma edição abaixo
        </p>
      )}
    </div>
  );
}
