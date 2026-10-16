import { hasPoints, settleOpen } from "./model.ts";
import type { PauseSpan, Walk, WalkPin, WalkPoint, WalkSegment } from "./types.ts";

const KEY = "walking-line.v1";

function isPoint(value: unknown): value is WalkPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as WalkPoint;
  return (
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lng) &&
    typeof point.t === "number" &&
    Number.isFinite(point.t) &&
    typeof point.accuracy === "number" &&
    Number.isFinite(point.accuracy)
  );
}

function isSegment(value: unknown): value is WalkSegment {
  if (!value || typeof value !== "object") return false;
  const segment = value as WalkSegment;
  return Array.isArray(segment.points) && segment.points.every(isPoint);
}

function isPause(value: unknown): value is PauseSpan {
  if (!value || typeof value !== "object") return false;
  const pause = value as PauseSpan;
  return typeof pause.at === "number" && (pause.resumedAt === null || typeof pause.resumedAt === "number");
}

function isPin(value: unknown): value is WalkPin {
  if (!value || typeof value !== "object") return false;
  const pin = value as WalkPin;
  return (
    typeof pin.id === "string" &&
    pin.id.length > 0 &&
    typeof pin.lat === "number" &&
    Number.isFinite(pin.lat) &&
    Math.abs(pin.lat) <= 90 &&
    typeof pin.lng === "number" &&
    Number.isFinite(pin.lng) &&
    Math.abs(pin.lng) <= 180 &&
    typeof pin.t === "number" &&
    Number.isFinite(pin.t) &&
    typeof pin.caption === "string" &&
    typeof pin.createdAt === "number" &&
    Number.isFinite(pin.createdAt)
  );
}

function withPins(walk: Walk): Walk {
  const raw = (walk as { pins?: unknown }).pins;
  const pins = Array.isArray(raw) ? raw.filter(isPin).map((pin) => ({ ...pin, caption: pin.caption.slice(0, 80) })) : [];
  return { ...walk, pins };
}

function isWalk(value: unknown): value is Walk {
  if (!value || typeof value !== "object") return false;
  const walk = value as Walk;
  return (
    typeof walk.id === "string" &&
    walk.id.length > 0 &&
    typeof walk.startedAt === "number" &&
    (walk.endedAt === null || typeof walk.endedAt === "number") &&
    Array.isArray(walk.pauses) &&
    walk.pauses.every(isPause) &&
    Array.isArray(walk.segments) &&
    walk.segments.every(isSegment)
  );
}

export function normalizeStored(walks: Walk[]): Walk[] {
  const next: Walk[] = [];
  for (const walk of walks) {
    if (!hasPoints(walk)) continue;
    if (walk.endedAt === null) {
      next.push(settleOpen(walk));
      continue;
    }
    next.push({ ...walk, segments: walk.segments.filter((segment) => segment.points.length > 0) });
  }
  return next;
}

export function loadWalks(): Walk[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { walks?: unknown }).walks)) return [];
    const walks = (parsed as { walks: unknown[] }).walks.filter(isWalk).slice(0, 400).map(withPins);
    return normalizeStored(walks);
  } catch {
    return [];
  }
}

export function trySaveWalks(walks: Walk[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ walks }));
    return true;
  } catch {
    return false;
  }
}

export function saveWalks(walks: Walk[]): void {
  trySaveWalks(walks);
}
