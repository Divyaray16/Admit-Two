import { VERY_POOR_ACCURACY_M, type WalkPoint, type WalkSegment } from "./types.ts";

export type PointDecision =
  | { kind: "accept" }
  | { kind: "replace" }
  | { kind: "reject"; reason: "invalid" | "poor" | "jitter" | "spike" | "stale" };

const EARTH_RADIUS_M = 6_371_000;
const STALE_MS = 20_000;
const SPIKE_SPEED_MPS = 45;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(a: Pick<WalkPoint, "lat" | "lng">, b: Pick<WalkPoint, "lat" | "lng">): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function finitePoint(point: WalkPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Number.isFinite(point.t) &&
    Number.isFinite(point.accuracy) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

/**
 * Keep a point only when it is a real movement.
 * Very poor accuracy is dropped. Small drifts inside the accuracy radius are dropped
 * so a stationary phone cannot scribble. A much tighter fix of the same place
 * replaces the previous sample instead of adding a spur.
 */
export function decidePoint(point: WalkPoint, previous: WalkPoint | undefined, now = Date.now()): PointDecision {
  if (!finitePoint(point) || point.accuracy < 0) return { kind: "reject", reason: "invalid" };
  if (point.accuracy > VERY_POOR_ACCURACY_M) return { kind: "reject", reason: "poor" };
  if (Math.abs(now - point.t) > STALE_MS) return { kind: "reject", reason: "stale" };
  if (!previous) return { kind: "accept" };
  if (point.t + 1500 < previous.t) return { kind: "reject", reason: "stale" };

  const meters = distanceMeters(previous, point);
  const seconds = Math.max(0, (point.t - previous.t) / 1000);
  const refined = point.accuracy + 15 < previous.accuracy && meters <= Math.max(12, previous.accuracy);
  if (refined) return { kind: "replace" };

  const floor = Math.max(8, point.accuracy);
  if (meters < floor) return { kind: "reject", reason: "jitter" };
  if (seconds < 2 && meters < 30) return { kind: "reject", reason: "jitter" };
  if (seconds > 0 && meters / seconds > SPIKE_SPEED_MPS) return { kind: "reject", reason: "spike" };
  if (seconds < 1 && meters > Math.max(floor, 30)) return { kind: "reject", reason: "spike" };
  return { kind: "accept" };
}

export type Trace = {
  id: string;
  segments: WalkSegment[];
};

export type XY = { x: number; y: number };

export type ProjectedTrace = {
  id: string;
  segments: XY[][];
};

export type GraticuleLine = { x1: number; y1: number; x2: number; y2: number };

export type ProjectedMarker = { id: string; x: number; y: number };

export type Projection = {
  strokes: ProjectedTrace[];
  graticule: GraticuleLine[];
  markers: ProjectedMarker[];
};

export type SpreadMark = {
  id: string;
  x: number;
  y: number;
  nx: number;
  ny: number;
  createdAt: number;
};

export type PlacedMark = {
  id: string;
  x: number;
  y: number;
  dotX: number;
  dotY: number;
};

/** Keep overlapping memories tappable. The newest mark steps out along the notch. */
export function spreadMarks(marks: SpreadMark[]): PlacedMark[] {
  const sorted = [...marks].sort((a, b) => a.createdAt - b.createdAt);
  const placed: { dotX: number; dotY: number }[] = [];
  return sorted.map((mark) => {
    let step = 0;
    let len = 12;
    let dotX = mark.x + mark.nx * len;
    let dotY = mark.y + mark.ny * len;
    while (step < 3 && placed.some((item) => Math.hypot(item.dotX - dotX, item.dotY - dotY) < 18)) {
      step += 1;
      len = 12 + step * 13;
      dotX = mark.x + mark.nx * len;
      dotY = mark.y + mark.ny * len;
    }
    placed.push({ dotX, dotY });
    return { id: mark.id, x: mark.x, y: mark.y, dotX, dotY };
  });
}

type LocalPoint = { x: number; y: number; lat: number; lng: number };

function normalizeLng(lng: number, origin: number): number {
  let next = lng;
  while (next - origin > 180) next -= 360;
  while (origin - next > 180) next += 360;
  return next;
}

function collect(traces: Trace[]): WalkPoint[] {
  const points: WalkPoint[] = [];
  for (const trace of traces) {
    for (const segment of trace.segments) {
      for (const point of segment.points) points.push(point);
    }
  }
  return points;
}

const MIN_SPAN = 0.0012;
const STEPS = [0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];

function niceStep(span: number): number {
  const rough = Math.max(span / 3, 1e-6);
  for (const step of STEPS) {
    if (step >= rough) return step;
  }
  return 10;
}

/**
 * Project traces into a north-up pixel frame.
 * Longitude is scaled by cos(latitude) so a city block is not stretched.
 */
export function projectTraces(
  traces: Trace[],
  width: number,
  height: number,
  pad: number,
  markers: { id: string; lat: number; lng: number }[] = [],
): Projection {
  const points = collect(traces);
  if (points.length === 0 || width < 8 || height < 8) return { strokes: [], graticule: [], markers: [] };

  const originLng = points[0]?.lng ?? 0;
  const midLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const cos = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const locals: LocalPoint[] = points.map((point) => ({
    x: normalizeLng(point.lng, originLng) * cos,
    y: point.lat,
    lat: point.lat,
    lng: normalizeLng(point.lng, originLng),
  }));

  let minX = Math.min(...locals.map((point) => point.x));
  let maxX = Math.max(...locals.map((point) => point.x));
  let minY = Math.min(...locals.map((point) => point.y));
  let maxY = Math.max(...locals.map((point) => point.y));
  if (maxX - minX < MIN_SPAN) {
    const center = (minX + maxX) / 2;
    minX = center - MIN_SPAN / 2;
    maxX = center + MIN_SPAN / 2;
  }
  if (maxY - minY < MIN_SPAN) {
    const center = (minY + maxY) / 2;
    minY = center - MIN_SPAN / 2;
    maxY = center + MIN_SPAN / 2;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const ox = (width - drawnW) / 2;
  const oy = (height - drawnH) / 2;

  const toScreen = (x: number, y: number): XY => ({
    x: ox + (x - minX) * scale,
    y: oy + (maxY - y) * scale,
  });

  let cursor = 0;
  const strokes: ProjectedTrace[] = traces.map((trace) => ({
    id: trace.id,
    segments: trace.segments.map((segment) => {
      const projected = segment.points.map((_, index) => {
        const local = locals[cursor + index];
        return local ? toScreen(local.x, local.y) : { x: 0, y: 0 };
      });
      cursor += segment.points.length;
      return projected;
    }),
  }));

  const viewMinX = minX - ox / scale;
  const viewMaxX = minX + (width - ox) / scale;
  const viewMaxY = maxY + oy / scale;
  const viewMinY = maxY - (height - oy) / scale;

  const graticule = buildGraticule({
    viewMinX,
    viewMaxX,
    viewMinY,
    viewMaxY,
    dataSpanX: spanX,
    dataSpanY: spanY,
    scale,
    toScreen,
  });

  const projectedMarkers = markers.map((marker) => {
    const localX = normalizeLng(marker.lng, originLng) * cos;
    const screen = toScreen(localX, marker.lat);
    return { id: marker.id, x: screen.x, y: screen.y };
  });

  return { strokes, graticule, markers: projectedMarkers };
}

function buildGraticule(input: {
  viewMinX: number;
  viewMaxX: number;
  viewMinY: number;
  viewMaxY: number;
  dataSpanX: number;
  dataSpanY: number;
  scale: number;
  toScreen: (x: number, y: number) => XY;
}): GraticuleLine[] {
  let latStep = niceStep(input.dataSpanY);
  let lngStep = niceStep(input.dataSpanX);
  while (latStep * input.scale < 64 && latStep < 20) latStep *= 2;
  while (lngStep * input.scale < 64 && lngStep < 20) lngStep *= 2;

  const lines: GraticuleLine[] = [];
  const yStart = Math.ceil(input.viewMinY / latStep) * latStep;
  for (let lat = yStart; lat <= input.viewMaxY + latStep * 0.01 && lines.length < 8; lat += latStep) {
    if (!Number.isFinite(lat)) break;
    const left = input.toScreen(input.viewMinX, lat);
    const right = input.toScreen(input.viewMaxX, lat);
    lines.push({ x1: left.x, y1: left.y, x2: right.x, y2: right.y });
  }

  const verticals: GraticuleLine[] = [];
  const xStart = Math.ceil(input.viewMinX / lngStep) * lngStep;
  for (let x = xStart; x <= input.viewMaxX + lngStep * 0.01 && verticals.length < 8; x += lngStep) {
    if (!Number.isFinite(x)) break;
    const top = input.toScreen(x, input.viewMaxY);
    const bottom = input.toScreen(x, input.viewMinY);
    verticals.push({ x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y });
  }
  return lines.concat(verticals);
}
