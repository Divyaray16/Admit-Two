import type { CreatedInvitation, Invitation, InvitationDraft, RsvpStatus, TicketColor, TicketForm } from "../types";
import { asTicketColor, asTicketForm } from "./ticketStyle";

const JSON_HEADERS = { accept: "application/json", "content-type": "application/json" };

async function fail(res: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim()) message = data.error;
  } catch {
    /* The server answered with something other than JSON. */
  }
  throw new Error(message);
}

function asInvitation(value: unknown): Invitation {
  if (!value || typeof value !== "object") throw new Error("The invitation couldn’t be opened.");
  const row = value as Partial<Invitation>;
  if (typeof row.publicId !== "string" || typeof row.title !== "string") {
    throw new Error("The invitation couldn’t be opened.");
  }
  const color: TicketColor = asTicketColor(row.ticketColor);
  const form: TicketForm = asTicketForm(row.ticketForm);
  return {
    publicId: row.publicId,
    senderName: typeof row.senderName === "string" ? row.senderName : "",
    recipientName: row.recipientName ?? null,
    title: row.title,
    eventDate: typeof row.eventDate === "string" ? row.eventDate : "",
    eventTime: typeof row.eventTime === "string" ? row.eventTime : "",
    location: row.location ?? null,
    message: typeof row.message === "string" ? row.message : "",
    note: row.note ?? null,
    ticketColor: color,
    ticketForm: form,
    audioUrl: typeof row.audioUrl === "string" ? row.audioUrl : null,
    audioDuration: typeof row.audioDuration === "number" && Number.isFinite(row.audioDuration) ? row.audioDuration : null,
    rsvpStatus: row.rsvpStatus === "accepted" || row.rsvpStatus === "declined" ? row.rsvpStatus : "pending",
    respondedAt: typeof row.respondedAt === "string" ? row.respondedAt : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    mode: "live",
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Couldn’t read the recording."));
    reader.readAsDataURL(blob);
  });
}

async function audioPayload(draft: InvitationDraft): Promise<{ mime: string; duration: number; data: string } | null> {
  if (!draft.audio) return null;
  if (draft.audio.blob.size > 2_000_000) throw new Error("That recording is too large. Try a shorter message.");
  return {
    mime: draft.audio.mime || "audio/webm",
    duration: Number(draft.audio.duration.toFixed(2)),
    data: await blobToBase64(draft.audio.blob),
  };
}

function invitationBody(draft: InvitationDraft, publicId: string, manageToken: string, audio: { mime: string; duration: number; data: string } | null) {
  return {
    publicId,
    manageToken,
    senderName: draft.senderName,
    recipientName: draft.recipientName,
    title: draft.title,
    eventDate: draft.eventDate,
    eventTime: draft.eventTime,
    location: draft.location,
    message: draft.message,
    note: draft.note,
    ticketColor: draft.ticketColor,
    ticketForm: draft.ticketForm,
    audio,
  };
}

export async function serverCreate(draft: InvitationDraft, publicId: string, manageToken: string): Promise<CreatedInvitation> {
  const audio = await audioPayload(draft);
  const res = await fetch("/api/invitations", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(invitationBody(draft, publicId, manageToken, audio)),
  });
  if (!res.ok) await fail(res, "The invitation couldn’t be saved.");
  const data = (await res.json()) as { publicId?: unknown };
  if (data.publicId !== publicId) throw new Error("The invitation couldn’t be saved.");
  return { publicId, manageToken, mode: "live" };
}

export async function serverAttachAudio(publicId: string, manageToken: string, draft: InvitationDraft): Promise<void> {
  const audio = await audioPayload(draft);
  if (!audio) return;
  const res = await fetch(`/api/invitations/${encodeURIComponent(publicId)}/audio`, {
    method: "POST",
    headers: { ...JSON_HEADERS, "x-manage-token": manageToken },
    body: JSON.stringify({ audio }),
  });
  if (!res.ok) await fail(res, "The voice message didn’t upload. You can try again.");
}

export async function serverGetPublic(publicId: string): Promise<Invitation | null> {
  const res = await fetch(`/api/invitations/${encodeURIComponent(publicId)}`, { headers: { accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) await fail(res, "The invitation couldn’t be opened.");
  return asInvitation(await res.json());
}

export async function serverRespond(publicId: string, status: Exclude<RsvpStatus, "pending">): Promise<Invitation> {
  const res = await fetch(`/api/invitations/${encodeURIComponent(publicId)}/rsvp`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ status }),
  });
  if (!res.ok) await fail(res, "The reply couldn’t be saved.");
  return asInvitation(await res.json());
}

export async function serverGetManaged(publicId: string, manageToken: string): Promise<Invitation | null> {
  const res = await fetch(`/api/invitations/${encodeURIComponent(publicId)}/manage`, {
    headers: { accept: "application/json", "x-manage-token": manageToken },
  });
  if (res.status === 404) return null;
  if (!res.ok) await fail(res, "The sender view couldn’t be opened.");
  return asInvitation(await res.json());
}
