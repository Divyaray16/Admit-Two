import type { FieldErrors, InvitationDraft } from "../types";

export function formatEventDate(isoDate: string): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  const mon = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${mon} ${day}, ${year}`;
}

export function ticketDateLabel(value: string): string {
  if (!value) return "";
  if (/^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}$/.test(value)) return value.toUpperCase();
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatEventDate(value.slice(0, 10));
  return value;
}

export function ticketTimeLabel(value: string): string {
  if (!value) return "";
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(value)) return value.replace(/\s*(am|pm)$/i, (suffix) => suffix.toUpperCase());
  if (/^\d{1,2}:\d{2}/.test(value)) return formatEventTime(value.slice(0, 5));
  return value;
}

export function visibleSender(name: string | null | undefined): string | null {
  const trimmed = (name ?? "").replace(/\u200b/g, "").trim();
  return trimmed || null;
}

export function mmDdYyyy(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return "";
  return `${month}.${day}.${year}`;
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isPastDate(isoDate: string): boolean {
  return isoDate < todayIso();
}

export function isPastTimeToday(isoDate: string, time: string): boolean {
  if (isoDate !== todayIso()) return false;
  const [hourPart, minutePart] = time.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const now = new Date();
  return hour * 60 + minute <= now.getHours() * 60 + now.getMinutes();
}

export function formatEventTime(time: string): string {
  if (!time) return "Time";
  const [hourPart, minutePart] = time.split(":");
  const hour = Number(hourPart);
  const minute = (minutePart ?? "00").slice(0, 2);
  if (Number.isNaN(hour)) return time;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${minutes}:${remain.toString().padStart(2, "0")}`;
}

export function formatRespondedAt(iso: string | null): string {
  if (!iso) return "Not yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function invitationUrl(publicId: string): string {
  const origin = window.location.origin;
  return `${origin}/i/${publicId}`;
}

export function validateDraft(draft: InvitationDraft): FieldErrors {
  const errors: FieldErrors = {};
  const sender = draft.senderName.trim();
  const title = draft.title.trim();
  const note = draft.note.trim();

  if (sender.length > 20) errors.senderName = "Keep your name under 20 characters.";

  if (!title) errors.title = "Add an event title.";
  else if (title.length > 30) errors.title = "Keep the title under 30 characters.";

  if (!draft.eventDate) errors.eventDate = "Choose a date.";
  else if (isPastDate(draft.eventDate)) {
    errors.eventDate = "The selected date has already passed. Please pick a future date.";
  }

  if (!draft.eventTime) errors.eventTime = "Choose a time.";
  else if (draft.eventDate && !errors.eventDate && isPastTimeToday(draft.eventDate, draft.eventTime)) {
    errors.eventTime = "The selected time has already passed today. Please pick a future time.";
  }

  if (!note) errors.note = "Add a note.";
  else if (note.length > 34) errors.note = "Keep the note under 34 characters.";

  return errors;
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
