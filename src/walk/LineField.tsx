import { useLayoutEffect, useRef, useState } from "react";
import { projectTraces, spreadMarks, type ProjectedTrace, type Trace } from "./geo.ts";

export type FieldPin = {
  id: string;
  lat: number;
  lng: number;
  caption: string;
  createdAt: number;
  active: boolean;
};

type LineFieldProps = {
  traces: Trace[];
  opacities: number[];
  showHead: boolean;
  reducedMotion: boolean;
  label: string;
  pins?: FieldPin[];
  onPin?: (id: string) => void;
};

function lastDrawnPoint(stroke: { segments: { x: number; y: number }[][] } | undefined): { x: number; y: number } | undefined {
  if (!stroke) return undefined;
  for (let index = stroke.segments.length - 1; index >= 0; index -= 1) {
    const segment = stroke.segments[index];
    const point = segment?.[segment.length - 1];
    if (point) return point;
  }
  return undefined;
}

function pathOf(points: { x: number; y: number }[]): string {
  const first = points[0];
  if (!first) return "";
  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    d += ` L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }
  return d;
}

function notchNormals(strokes: ProjectedTrace[], markers: { id: string; x: number; y: number }[]) {
  return markers.map((marker) => {
    let best = Number.POSITIVE_INFINITY;
    let tangentX = 0;
    let tangentY = -1;
    for (const stroke of strokes) {
      for (const segment of stroke.segments) {
        for (let index = 0; index < segment.length; index += 1) {
          const point = segment[index];
          if (!point) continue;
          const distance = Math.hypot(point.x - marker.x, point.y - marker.y);
          if (distance >= best) continue;
          best = distance;
          const before = segment[Math.max(0, index - 1)] ?? point;
          const after = segment[Math.min(segment.length - 1, index + 1)] ?? point;
          tangentX = after.x - before.x;
          tangentY = after.y - before.y;
        }
      }
    }
    const length = Math.hypot(tangentX, tangentY);
    if (length < 0.001) return { ...marker, nx: 0, ny: -1 };
    let nx = -tangentY / length;
    let ny = tangentX / length;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    return { ...marker, nx, ny };
  });
}

export function LineField({ traces, opacities, showHead, reducedMotion, label, pins = [], onPin }: LineFieldProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const w = Math.max(0, Math.round(rect.width));
      const h = Math.max(0, Math.round(rect.height));
      setSize((current) => (current.w === w && current.h === h ? current : { w, h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const projection =
    size.w > 0 && size.h > 0
      ? projectTraces(
          traces,
          size.w,
          size.h,
          60,
          pins.map((pin) => ({ id: pin.id, lat: pin.lat, lng: pin.lng })),
        )
      : { strokes: [], graticule: [], markers: [] };
  const head = showHead ? lastDrawnPoint(projection.strokes[projection.strokes.length - 1]) : undefined;
  const placed = spreadMarks(
    notchNormals(projection.strokes, projection.markers).map((mark) => ({
      ...mark,
      createdAt: pins.find((pin) => pin.id === mark.id)?.createdAt ?? 0,
    })),
  );

  return (
    <div className="wl-stage" ref={ref}>
      {size.w > 0 && size.h > 0 ? (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
          {projection.strokes.map((stroke, index) => (
            <g key={stroke.id} opacity={opacities[index] ?? 1}>
              {stroke.segments.map((segment, segmentIndex) => {
                const only = segment[0];
                if (!only) return null;
                if (segment.length === 1) {
                  return <circle key={segmentIndex} className="wl-dot" cx={only.x} cy={only.y} r={2.4} />;
                }
                return <path key={segmentIndex} d={pathOf(segment)} />;
              })}
            </g>
          ))}
          {placed.map((mark) => {
            const pin = pins.find((item) => item.id === mark.id);
            return (
              <g key={mark.id} aria-hidden="true">
                <line className="wl-stem" x1={mark.x} y1={mark.y} x2={mark.dotX} y2={mark.dotY} />
                <circle className="wl-dot" cx={mark.x} cy={mark.y} r={1.6} />
                <circle className={pin?.active ? "wl-pin-head is-open" : "wl-pin-head"} cx={mark.dotX} cy={mark.dotY} r={2.6} />
              </g>
            );
          })}
          {head ? (
            <g aria-hidden="true">
              {reducedMotion ? null : <circle cx={head.x} cy={head.y} r={7} className="wl-head-ring" />}
              <circle cx={head.x} cy={head.y} r={3.1} className="wl-head-core" />
            </g>
          ) : null}
        </svg>
      ) : null}
      {placed.map((mark) => {
        const pin = pins.find((item) => item.id === mark.id);
        const caption = pin?.caption.trim() ?? "";
        return (
          <button
            key={mark.id}
            type="button"
            className="wl-notch"
            data-pin={mark.id}
            style={{ left: mark.dotX, top: mark.dotY }}
            aria-pressed={pin?.active ?? false}
            aria-label={caption ? `Picture, ${caption}` : "Pinned picture"}
            onClick={() => onPin?.(mark.id)}
          />
        );
      })}
    </div>
  );
}
