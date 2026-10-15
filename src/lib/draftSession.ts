import type { TicketColor, TicketForm } from "../types";
import { asTicketColor, asTicketForm } from "./ticketStyle";

const KEY = "admittwo.create.v1";
const EDIT = "admittwo.editing";

export type StoredCreateDraft = {
  title: string;
  eventDate: string;
  eventTime: string;
  note: string;
  senderName: string;
  ticketColor: TicketColor;
  ticketForm: TicketForm;
};

export function saveCreateDraft(draft: StoredCreateDraft): void {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function markEditing(): void {
  sessionStorage.setItem(EDIT, "1");
}

export function clearEditing(): void {
  sessionStorage.removeItem(EDIT);
}

export function consumeEditDraft(): StoredCreateDraft | null {
  if (sessionStorage.getItem(EDIT) !== "1") return null;
  sessionStorage.removeItem(EDIT);
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCreateDraft>;
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      eventDate: typeof parsed.eventDate === "string" ? parsed.eventDate : "",
      eventTime: typeof parsed.eventTime === "string" ? parsed.eventTime : "",
      note: typeof parsed.note === "string" ? parsed.note : "",
      senderName: typeof parsed.senderName === "string" ? parsed.senderName : "",
      ticketColor: asTicketColor(parsed.ticketColor),
      ticketForm: asTicketForm(parsed.ticketForm),
    };
  } catch {
    return null;
  }
}
