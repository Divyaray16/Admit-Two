import type { FieldErrors, InvitationDraft } from "../types";

export function formatEventDate(isoDate: string): string {
  if (!isoDate) return "Date";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return "Date";
  const date = new Date(year, month - 1, day);
  const mon = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${mon} ${day}, ${year}`;
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
  const message = draft.message.trim();

  if (!sender) errors.senderName = "Add your name.";
  else if (sender.length > 60) errors.senderName = "Keep your name under 60 characters.";

  if (draft.recipientName.trim().length > 60) {
    errors.recipientName = "Keep their name under 60 characters.";
  }

  if (!title) errors.title = "Give the invitation a title.";
  else if (title.length > 80) errors.title = "Keep the title under 80 characters.";

  if (!draft.eventDate) errors.eventDate = "Choose a date.";
  if (!draft.eventTime) errors.eventTime = "Choose a time.";

  if (draft.location.trim().length > 120) {
    errors.location = "Keep the location under 120 characters.";
  }

  if (!message) errors.message = "Write a short invitation.";
  else if (message.length > 500) errors.message = "Keep the message under 500 characters.";

  if (draft.note.trim().length > 140) {
    errors.note = "Keep the note under 140 characters.";
  }

  return errors;
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
