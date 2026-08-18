"use client";

import { useState } from "react";

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

export default function CommanderPrintCarousel({
  prints,
  alt,
}: Props) {
  const [current, setCurrent] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  if (prints.length === 0) {
    return null;
  }

  const selected = prints[current];

  function previous() {
    setCurrent((index) =>
      index === 0 ? prints.length - 1 : index - 1
    );
  }

  function next() {
    setCurrent((index) =>
      index === prints.length - 1 ? 0 : index + 1
    );
  }

  function getRelativePosition(index: number) {
    let distance = index - current;

    if (distance > prints.length / 2) {
      distance -= prints.length;
    }

    if (distance < -prints.length / 2) {
      distance += prints.length;
    }

    return distance;
  }

  function handlePointerDown(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    setDragStart(event.clientX);
    setDragging(true);
    setDragOffset(0);

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    if (!dragging || dragStart === null) {
      return;
    }

    const offset = event.clientX - dragStart;

    setDragOffset(offset);
  }

  function handlePointerUp(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    if (!dragging) {
      return;
    }

    const threshold = 70;

    if (dragOffset > threshold) {
      previous();
    } else if (dragOffset < -threshold) {
      next();
    }

    setDragging(false);
    setDragStart(null);
    setDragOffset(0);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
  }

  return (
    <div className="w-full">
      <div
        className={`
          relative
          mx-auto
          h-[430px]
          w-full
          max-w-[520px]
          select-none
          overflow-hidden
          touch-pan-y
          ${
            dragging
              ? "cursor-grabbing"
              : "cursor-grab"
          }
        `}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {prints.map((print, index) => {
          const position = getRelativePosition(index);

          if (Math.abs(position) > 1) {
            return null;
          }

          const active = position === 0;

          const movement = dragOffset;

          let baseX = 0;
          let translateY = 0;
          let scale = 1;
          let rotateY = 0;
          let rotateZ = 0;
          let opacity = 1;
          let zIndex = 10;

          if (position === 0) {
            baseX = -50;
            translateY = 0;
            scale = 1;
            rotateY = 0;
            rotateZ = 0;
            opacity = 1;
            zIndex = 30;
          }

          if (position === -1) {
            baseX = -115;
            translateY = 28;
            scale = 0.78;
            rotateY = 15;
            rotateZ = -5;
            opacity = 0.32;
            zIndex = 10;
          }

          if (position === 1) {
            baseX = 15;
            translateY = 28;
            scale = 0.78;
            rotateY = -15;
            rotateZ = 5;
            opacity = 0.32;
            zIndex = 10;
          }

          const dragPercent = movement / 2.6;

          const transform = `
            translateX(calc(${baseX}% + ${movement}px))
            translateY(${translateY}px)
            scale(${scale})
            rotateY(${rotateY - dragPercent * 0.12}deg)
            rotateZ(${rotateZ + dragPercent * 0.03}deg)
          `;

          return (
            <button
              key={print.id}
              type="button"
              onClick={() => {
                if (dragging) return;

                if (position === -1) previous();
                if (position === 1) next();
              }}
              className="absolute left-1/2 top-4 w-[260px] outline-none"
              style={{
                transform,
                opacity,
                zIndex,
                transition: dragging
                  ? "none"
                  : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms ease",
                transformStyle: "preserve-3d",
              }}
            >
              <img
                src={print.image}
                alt={`${alt} — ${print.set_name}`}
                draggable={false}
                className={`
                  pointer-events-none
                  w-full
                  rounded-2xl
                  ${
                    active
                      ? "brightness-100 drop-shadow-[0_24px_30px_rgba(0,0,0,0.55)]"
                      : "brightness-50"
                  }
                `}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-1 text-center">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">
          {selected.set_name}
          {selected.released_at
            ? ` • ${selected.released_at.slice(0, 4)}`
            : ""}
        </p>

        {prints.length > 1 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {prints.map((print, index) => (
              <button
                key={print.id}
                type="button"
                onClick={() => setCurrent(index)}
                aria-label={`Ver versão ${print.set_name}`}
                className={`
                  h-2
                  rounded-full
                  transition-all
                  duration-300
                  ${
                    index === current
                      ? "w-7 bg-[#f4f1e8]"
                      : "w-2 bg-white/20 hover:bg-white/45"
                  }
                `}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}