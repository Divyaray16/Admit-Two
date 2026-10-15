import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type ScaledBoxProps = {
  width: number;
  height: number;
  children: ReactNode;
  className?: string;
};

export function ScaledBox({ width, height, children, className }: ScaledBoxProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = measureRef.current;
    if (!element) return;
    const measure = () => {
      const available = element.clientWidth;
      if (available <= 0) return;
      setScale(Math.min(1, available / width));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={measureRef} className={className ?? "w-full"}>
      <div className="relative mx-auto overflow-visible" style={{ width: width * scale, height: height * scale }}>
        <div className="relative" style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
