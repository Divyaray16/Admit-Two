import type { TicketColor, TicketForm } from "../types";

export type { TicketColor, TicketForm };

export const TICKET_COLORS: Array<{ key: TicketColor; bg: string }> = [
  { key: "green", bg: "#C0C8B0" },
  { key: "white", bg: "#F6F1EA" },
  { key: "pink", bg: "#E6C8BD" },
  { key: "violet", bg: "#CFBFE1" },
  { key: "blue", bg: "#DADDE2" },
];

export const SAMPLE_SENDER = "Divya Ray";

export const SAMPLE_TICKETS: Array<{
  title: string;
  note: string;
  color: TicketColor;
  form: TicketForm;
  date: string;
  time: string;
}> = [
  {
    title: "sunset picnic over the city",
    note: "bring a blanket & your fav person",
    color: "green",
    form: 1,
    date: "Aug 15, 2026",
    time: "6:30 PM",
  },
  {
    title: "movie night, just us two",
    note: "i'll bring the popcorn",
    color: "blue",
    form: 2,
    date: "Sep 3, 2026",
    time: "8:00 PM",
  },
  {
    title: "coffee & a long walk",
    note: "no phones, just us",
    color: "pink",
    form: 3,
    date: "Oct 12, 2026",
    time: "10:00 AM",
  },
  {
    title: "girls night, finally",
    note: "so much to catch up on",
    color: "violet",
    form: 1,
    date: "Jul 20, 2026",
    time: "7:00 PM",
  },
  {
    title: "surprise birthday dinner",
    note: "act surprised, okay?",
    color: "green",
    form: 2,
    date: "Nov 8, 2026",
    time: "7:30 PM",
  },
  {
    title: "mom, let me take you out",
    note: "just because",
    color: "blue",
    form: 3,
    date: "Dec 14, 2026",
    time: "1:00 PM",
  },
  {
    title: "emergency ice cream meeting",
    note: "it's urgent, trust me",
    color: "pink",
    form: 1,
    date: "Aug 2, 2026",
    time: "3:00 PM",
  },
  {
    title: "surprise outing",
    note: "no plan, just vibes",
    color: "violet",
    form: 2,
    date: "Sep 20, 2026",
    time: "12:00 PM",
  },
];

const WAVE = [
  0.15, 0.4, 0.7, 0.5, 0.85, 0.6, 0.3, 0.45, 0.75, 1, 0.55, 0.35, 0.6, 0.9, 0.5, 0.25, 0.7, 0.95, 0.45, 0.3, 0.65,
  0.8, 0.4, 0.2, 0.55, 0.85, 0.6, 0.35, 0.75, 0.5, 0.3, 0.15,
];

export function waveform(count: number, min: number, max: number): number[] {
  if (!Number.isFinite(count) || count <= 0) return [];
  const bars: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const pos = count === 1 ? 0 : (index / (count - 1)) * (WAVE.length - 1);
    const low = Math.floor(pos);
    const high = Math.min(low + 1, WAVE.length - 1);
    const mix = pos - low;
    const sample = (WAVE[low] ?? 0) * (1 - mix) + (WAVE[high] ?? 0) * mix;
    bars.push(min + sample * (max - min));
  }
  return bars;
}

export const STUB_BARS = waveform(21, 4.068, 16.948);
export const PLAYER_BARS = waveform(28, 6, 24);

export function asTicketColor(value: unknown): TicketColor {
  if (value === "white" || value === "pink" || value === "violet" || value === "blue" || value === "green") return value;
  return "green";
}

export function asTicketForm(value: unknown): TicketForm {
  if (value === 2 || value === 3 || value === "2" || value === "3") return Number(value) as TicketForm;
  return 1;
}

export function encodeTicketStyle(color: TicketColor, form: TicketForm): string {
  return `style:${color}:${form}`;
}

export function decodeTicketStyle(location: string | null): {
  color: TicketColor;
  form: TicketForm;
  location: string | null;
} {
  const match = location?.match(/^style:(green|white|pink|violet|blue):([123])$/);
  if (!match) return { color: "green", form: 1, location };
  return {
    color: asTicketColor(match[1]),
    form: asTicketForm(match[2]),
    location: null,
  };
}

export function ticketAsset(form: TicketForm, color: TicketColor, part: string): string {
  return `/figmaAssets/tickets/form_${form}_${color}_${part}.svg`;
}
