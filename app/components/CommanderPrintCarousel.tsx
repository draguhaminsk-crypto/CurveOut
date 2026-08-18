"use client";

import { useRef, useState } from "react";
import type { UIEvent } from "react";

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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (prints.length === 0) {
    return null;
  }

  const selected = prints[current];

  function goTo(index: number) {
    const container = containerRef.current;
    const card = cardRefs.current[index];

    if (!container || !card) {
      return;
    }

    setCurrent(index);

    const left =
      card.offsetLeft -
      container.clientWidth / 2 +
      card.clientWidth / 2;

    container.scrollTo({
      left,
      behavior: "smooth",
    });
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const container = event.currentTarget;

    const center =
      container.scrollLeft + container.clientWidth / 2;

    let closestIndex = 0;
    let closestDistance = Infinity;

    cardRefs.current.forEach((card, index) => {
      if (!card) {
        return;
      }

      const cardCenter =
        card.offsetLeft + card.offsetWidth / 2;

      const distance = Math.abs(cardCenter - center);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setCurrent(closestIndex);
  }

  function getCardTransform(index: number) {
    const distance = index - current;

    if (distance === 0) {
      return {
        transform:
          "perspective(1000px) translateY(0px) scale(1) rotateY(0deg) rotateZ(0deg)",
        opacity: 1,
        zIndex: 30,
      };
    }

    if (distance === -1) {
      return {
        transform:
          "perspective(1000px) translateY(18px) scale(0.88) rotateY(14deg) rotateZ(-4deg)",
        opacity: 0.55,
        zIndex: 20,
      };
    }

    if (distance === 1) {
      return {
        transform:
          "perspective(1000px) translateY(18px) scale(0.88) rotateY(-14deg) rotateZ(4deg)",
        opacity: 0.55,
        zIndex: 20,
      };
    }

    if (distance < -1) {
      return {
        transform:
          "perspective(1000px) translateY(34px) scale(0.76) rotateY(20deg) rotateZ(-7deg)",
        opacity: 0.22,
        zIndex: 10,
      };
    }

    return {
      transform:
        "perspective(1000px) translateY(34px) scale(0.76) rotateY(-20deg) rotateZ(7deg)",
      opacity: 0.22,
      zIndex: 10,
    };
  }

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="
          flex
          snap-x
          snap-mandatory
          items-center
          gap-0
          overflow-x-auto
          overflow-y-hidden
          py-10
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
        style={{
          paddingLeft: "calc(50% - 145px)",
          paddingRight: "calc(50% - 145px)",
        }}
      >
        {prints.map((print, index) => {
          const active = current === index;
          const visual = getCardTransform(index);

          return (
            <button
              key={print.id}
              ref={(element) => {
                cardRefs.current[index] = element;
              }}
              type="button"
              onClick={() => goTo(index)}
              className="
                relative
                w-[290px]
                shrink-0
                snap-center
                cursor-pointer
                outline-none
              "
              style={{
                transform: visual.transform,
                opacity: visual.opacity,
                zIndex: visual.zIndex,
                marginLeft: index === 0 ? 0 : "-65px",
                transition:
                  "transform 350ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms ease",
              }}
            >
              <img
                src={print.image}
                alt={`${alt} — ${print.set_name}`}
                draggable={false}
                className={`
                  w-full
                  select-none
                  rounded-2xl
                  transition-all
                  duration-300
                  ${
                    active
                      ? "brightness-100 drop-shadow-[0_25px_30px_rgba(0,0,0,0.55)]"
                      : "brightness-75"
                  }
                `}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-2 text-center">
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
                onClick={() => goTo(index)}
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