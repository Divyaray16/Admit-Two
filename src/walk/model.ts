import { WEEK_MS, type Walk, type WalkPin, type WalkPoint, type WalkSegment } from "./types.ts";

export function hasPoints(walk: Walk): boolean {
  return walk.segments.some((segment) => segment.points.length > 0);
}

export function lastPoint(walk: Walk): WalkPoint | undefined {
  for (let index = walk.segments.length - 1; index >= 0; index -= 1) {
    const segment = walk.segments[index];
    if (segment && segment.points.length > 0) return segment.points[segment.points.length - 1];
  }
  return undefined;
}

export function freshTail(segments: WalkSegment[]): WalkSegment[] {
  const kept = segments.filter((segment) => segment.points.length > 0);
  return [...kept, { points: [] }];
}

/** An abandoned live walk should read as paused, timed up to its last point. */
export function settleOpen(walk: Walk): Walk {
  if (walk.endedAt !== null || !hasPoints(walk)) return walk;
  const segments = walk.segments.some((segment) => segment.points.length === 0)
    ? walk.segments
    : freshTail(walk.segments);
  if (walk.pauses.some((pause) => pause.resumedAt === null)) return { ...walk, segments };
  const at = lastPoint(walk)?.t ?? walk.startedAt;
  return { ...walk, segments, pauses: [...walk.pauses, { at, resumedAt: null }] };
}

export function activeDuration(walk: Walk, now: number): number {
  const stop = walk.endedAt ?? now;
  let paused = 0;
  for (const span of walk.pauses) {
    const resume = span.resumedAt ?? stop;
    paused += Math.max(0, Math.min(resume, stop) - span.at);
  }
  return Math.max(0, stop - walk.startedAt - paused);
}

export function inLastWeek(walk: Walk, now: number): boolean {
  if (!hasPoints(walk)) return false;
  if (walk.endedAt === null) return true;
  const start = now - WEEK_MS;
  if (walk.startedAt >= start || walk.endedAt >= start) return true;
  return walk.segments.some((segment) => segment.points.some((point) => point.t >= start));
}

export function weekWalks(walks: Walk[], now: number): Walk[] {
  return walks.filter((walk) => inLastWeek(walk, now)).sort((a, b) => a.startedAt - b.startedAt);
}

function startOfLocalDay(t: number): number {
  const date = new Date(t);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Today is full cream. Each older day steps back, through the week. */
export function dayOpacity(walk: Walk, now: number): number {
  const t = lastPoint(walk)?.t ?? walk.startedAt;
  const age = Math.round((startOfLocalDay(now) - startOfLocalDay(t)) / 86_400_000);
  const clamped = Math.min(6, Math.max(0, age));
  return 1 - clamped * 0.11;
}

export function findPin(walks: Walk[], id: string): { walkId: string; pin: WalkPin } | null {
  for (const walk of walks) {
    const pin = (walk.pins ?? []).find((item) => item.id === id);
    if (pin) return { walkId: walk.id, pin };
  }
  return null;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const body = `${minutes}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : body;
}

export function formatSpokenDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(hours === 1 ? "1 hour" : `${hours} hours`);
  if (minutes > 0) parts.push(minutes === 1 ? "1 minute" : `${minutes} minutes`);
  if (hours === 0 && seconds > 0) parts.push(seconds === 1 ? "1 second" : `${seconds} seconds`);
  return parts.length > 0 ? parts.join(" ") : "0 seconds";
}

export function formatQuietDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return "Under a minute";
  if (minutes === 1) return "1 minute";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${hours}h ${rest}m`;
}

export function formatWalkDate(t: number): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(t));
}

export function applyPoint(walk: Walk, point: WalkPoint, mode: "accept" | "replace"): Walk {
  const segments = walk.segments.map((segment) => ({ points: segment.points.slice() }));
  if (segments.length === 0) segments.push({ points: [] });
  const tail = segments[segments.length - 1];
  if (!tail) return walk;
  if (mode === "replace" && tail.points.length > 0) {
    tail.points[tail.points.length - 1] = point;
    return { ...walk, segments };
  }
  if (mode === "replace" && tail.points.length === 0) return walk;
  tail.points.push(point);
  return { ...walk, segments };
}
