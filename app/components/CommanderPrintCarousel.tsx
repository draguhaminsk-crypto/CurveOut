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

function circularDistance(index: number, current: number, length: number) {
  let distance = index - current;
  const half = length / 2;

  if (distance > half) distance -= length;
  if (distance < -half) distance += length;

  return distance;
}

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

  function selectPrint(printIndex: number) {
    if (dragged.current) {
      dragged.current = false;
      return;
    }

    setIndex(printIndex);
  }

  return (
    <div className="mx-auto w-full max-w-[560px] select-none">
      <div
        className="relative mx-auto h-[500px] w-full touch-pan-y overflow-hidden cursor-grab active:cursor-grabbing"
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
        {/* Fita / coverflow: a edição atual fica no meio e as vizinhas aparecem dos lados. */}
        {safePrints.map((print, printIndex) => {
          const distance = circularDistance(
            printIndex,
            currentIndex,
            safePrints.length
          );

          if (Math.abs(distance) > 2) return null;

          const absDistance = Math.abs(distance);
          const translateX =
            distance === 0
              ? 0
              : distance === -1
                ? -188
                : distance === 1
                  ? 188
                  : distance === -2
                    ? -310
                    : 310;
          const scale = absDistance === 0 ? 1 : absDistance === 1 ? 0.78 : 0.62;
          const opacity = absDistance === 0 ? 1 : absDistance === 1 ? 0.72 : 0.3;
          const zIndex = absDistance === 0 ? 30 : absDistance === 1 ? 20 : 10;

          return (
            <button
              key={print.id}
              type="button"
              aria-label={`Ver impressão ${print.set_name}`}
              title={`${print.set_name}${print.set ? ` (${print.set.toUpperCase()})` : ""}`}
              onClick={() => selectPrint(printIndex)}
              className="absolute left-1/2 top-1/2 w-[300px] origin-center -translate-x-1/2 -translate-y-1/2 rounded-[18px] outline-none transition-[transform,opacity,filter] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-white/60"
              style={{
                zIndex,
                opacity,
                filter: absDistance === 0 ? "none" : "brightness(0.72)",
                transform: `translate(-50%, -50%) translateX(${translateX}px) scale(${scale})`,
              }}
            >
              <img
                src={print.image}
                alt={`${alt} — ${print.set_name}`}
                draggable={false}
                loading={absDistance === 0 ? "eager" : "lazy"}
                decoding="async"
                className={`w-full rounded-2xl border bg-[#111113] object-contain shadow-2xl transition duration-300 ${
                  absDistance === 0
                    ? "border-white/20 shadow-black/55"
                    : "border-white/10 shadow-black/35 hover:border-white/30 hover:brightness-110"
                }`}
              />
            </button>
          );
        })}

        {safePrints.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Impressão anterior"
              onClick={(event) => {
                event.stopPropagation();
                move(-1);
              }}
              className="absolute left-2 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 text-2xl text-white/75 shadow-lg backdrop-blur transition hover:border-white/35 hover:bg-black hover:text-white md:left-3"
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
              className="absolute right-2 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 text-2xl text-white/75 shadow-lg backdrop-blur transition hover:border-white/35 hover:bg-black hover:text-white md:right-3"
            >
              ›
            </button>
          </>
        )}
      </div>

      <div className="mt-1 text-center">
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
        <>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {safePrints.map((print, printIndex) => (
              <button
                key={print.id}
                type="button"
                aria-label={`Ir para ${print.set_name}`}
                onClick={() => setIndex(printIndex)}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  printIndex === currentIndex
                    ? "w-6 bg-white/70"
                    : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.14em] text-white/20">
            Arraste, use as setas ou clique nas cartas ao lado
          </p>
        </>
      )}
    </div>
  );
}
