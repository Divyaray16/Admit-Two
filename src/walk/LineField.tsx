import { useLayoutEffect, useRef, useState } from "react";
import { projectTraces, type Trace } from "./geo.ts";

type LineFieldProps = {
  traces: Trace[];
  opacities: number[];
  showHead: boolean;
  reducedMotion: boolean;
  label: string;
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

export function LineField({ traces, opacities, showHead, reducedMotion, label }: LineFieldProps) {
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

  const projection = size.w > 0 && size.h > 0 ? projectTraces(traces, size.w, size.h, 36) : { strokes: [], graticule: [] };
  const head = showHead ? lastDrawnPoint(projection.strokes[projection.strokes.length - 1]) : undefined;

  return (
    <div className="wl-stage" ref={ref}>
      {size.w > 0 && size.h > 0 ? (
        <svg
          viewBox={`0 0 ${size.w} ${size.h}`}
          role="img"
          aria-label={label}
          preserveAspectRatio="xMidYMid meet"
        >
          <g className="wl-graticule" aria-hidden="true">
            {projection.graticule.map((line, index) => (
              <line key={index} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
            ))}
          </g>
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
          {head ? (
            <g aria-hidden="true">
              {reducedMotion ? null : <circle cx={head.x} cy={head.y} r={7} className="wl-head-ring" />}
              <circle cx={head.x} cy={head.y} r={3.1} className="wl-head-core" />
            </g>
          ) : null}
        </svg>
      ) : null}
      <div className="wl-north" aria-hidden="true">
        N
      </div>
    </div>
  );
}
