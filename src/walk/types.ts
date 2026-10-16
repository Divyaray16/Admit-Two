export type WalkPoint = {
  lat: number;
  lng: number;
  /** Milliseconds since the unix epoch. */
  t: number;
  /** Reported accuracy radius in meters. */
  accuracy: number;
};

export type WalkSegment = {
  points: WalkPoint[];
};

export type PauseSpan = {
  at: number;
  resumedAt: number | null;
};

export type Walk = {
  id: string;
  startedAt: number;
  endedAt: number | null;
  pauses: PauseSpan[];
  /** A pause starts a new segment so the stroke does not jump the gap. */
  segments: WalkSegment[];
};

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Readings worse than this are noise, not a place the line should visit. */
export const VERY_POOR_ACCURACY_M = 100;
