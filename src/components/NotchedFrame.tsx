import { useLayoutEffect, useRef, useState } from "react";

function concavePath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(8, Math.min(r, w / 2.4, h / 2.4));
  const right = x + w;
  const bottom = y + h;
  return [
    `M ${x + radius} ${y}`,
    `H ${right - radius}`,
    `Q ${right - radius} ${y + radius} ${right} ${y + radius}`,
    `V ${bottom - radius}`,
    `Q ${right - radius} ${bottom - radius} ${right - radius} ${bottom}`,
    `H ${x + radius}`,
    `Q ${x + radius} ${bottom - radius} ${x} ${bottom - radius}`,
    `V ${y + radius}`,
    `Q ${x + radius} ${y + radius} ${x + radius} ${y}`,
  ].join(" ");
}

type NotchedFrameProps = {
  inset?: number;
  radius?: number;
};

export function NotchedFrame({ inset = 12, radius = 18 }: NotchedFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setBox({ w: element.clientWidth, h: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const width = Math.max(0, box.w - inset * 2);
  const height = Math.max(0, box.h - inset * 2);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {width > 0 && height > 0 ? (
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${box.w} ${box.h}`}>
          <path
            d={concavePath(inset, inset, width, height, radius)}
            fill="none"
            stroke="#3A4048"
            strokeWidth="1.35"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
    </div>
  );
}
