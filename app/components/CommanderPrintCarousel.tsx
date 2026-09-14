"use client";

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

  if (safePrints.length === 0) return null;

  const current = safePrints[Math.min(index, safePrints.length - 1)];

  function move(direction: -1 | 1) {
    setIndex((value) => {
      const next = value + direction;
      if (next < 0) return safePrints.length - 1;
      if (next >= safePrints.length) return 0;
      return next;
    });
  }

  return (
    <div className="mx-auto w-full max-w-[420px] select-none">
      <div
        className="relative"
        onPointerDown={(event) => {
          dragStartX.current = event.clientX;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (dragStartX.current === null) return;
          const delta = event.clientX - dragStartX.current;
          dragStartX.current = null;
          if (Math.abs(delta) < 35) return;
          move(delta > 0 ? -1 : 1);
        }}
      >
        <img
          src={current.image}
          alt={`${alt} — ${current.set_name}`}
          draggable={false}
          className="mx-auto w-full max-w-[340px] rounded-2xl shadow-2xl"
        />

        {safePrints.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Impressão anterior"
              onClick={() => move(-1)}
              className="absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-2xl text-white/70 backdrop-blur transition hover:border-white/30 hover:text-white"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Próxima impressão"
              onClick={() => move(1)}
              className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-2xl text-white/70 backdrop-blur transition hover:border-white/30 hover:text-white"
            >
              ›
            </button>
          </>
        )}
      </div>

      {safePrints.length > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2 overflow-x-auto pb-1">
          {safePrints.map((print, printIndex) => (
            <button
              key={print.id}
              type="button"
              title={`${print.set_name} (${print.set.toUpperCase()})`}
              onClick={() => setIndex(printIndex)}
              className={`h-2.5 w-2.5 shrink-0 rounded-full transition ${
                printIndex === index ? "bg-white" : "bg-white/20 hover:bg-white/45"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
