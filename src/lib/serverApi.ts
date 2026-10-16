import type { CreatedInvitation, Invitation, InvitationDraft, RsvpStatus, TicketColor, TicketForm } from "../types";
import { asTicketColor, asTicketForm } from "./ticketStyle";

const JSON_HEADERS = { accept: "application/json", "content-type": "application/json" };

/**
 * Vite inlines VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY at build time.
 * A Vercel Preview deployment does not receive variables scoped to Production
 * only, so this static host has no Supabase client and no /api/invitations server.
 */
export const MISSING_SUPABASE_DEPLOYMENT =
  "This deployment was built without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, so the invitation can’t be saved. Add both to the Vercel Preview environment as well as Production, then redeploy. Vite inlines them at build time, and Production-only values are not included in preview builds.";

function deploymentError(fallback: string): string {
  return import.meta.env.PROD ? MISSING_SUPABASE_DEPLOYMENT : fallback;
}

function errorFromBody(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("error" in data)) return null;
  const message = data.error;
  return typeof message === "string" && message.trim() ? message : null;
}

async function readJsonBody(res: Response, fallback: string, missingIsNull = false): Promise<unknown> {
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  const text = await res.text();
  const trimmed = text.trim();
  const looksJson = type.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[");

  if (missingIsNull && res.status === 404 && looksJson) return null;
  if (!looksJson) throw new Error(deploymentError(fallback));

  let data: unknown;
  try {
    data = trimmed ? (JSON.parse(trimmed) as unknown) : null;
  } catch {
    throw new Error(deploymentError(fallback));
  }

  if (!res.ok) throw new Error(errorFromBody(data) ?? deploymentError(fallback));
  return data;
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
  const data = (await readJsonBody(res, "The invitation couldn’t be saved.")) as { publicId?: unknown };
  if (!data || data.publicId !== publicId) throw new Error(deploymentError("The invitation couldn’t be saved."));
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
  await readJsonBody(res, "The voice message didn’t upload. You can try again.");
}

export async function serverGetPublic(publicId: string): Promise<Invitation | null> {
  const res = await fetch(`/api/invitations/${encodeURIComponent(publicId)}`, { headers: { accept: "application/json" } });
  const data = await readJsonBody(res, "The invitation couldn’t be opened.", true);
  if (data == null) return null;
  return asInvitation(data);
}

export async function serverRespond(publicId: string, status: Exclude<RsvpStatus, "pending">): Promise<Invitation> {
  const res = await fetch(`/api/invitations/${encodeURIComponent(publicId)}/rsvp`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ status }),
  });
  return asInvitation(await readJsonBody(res, "The reply couldn’t be saved."));
}

export async function serverGetManaged(publicId: string, manageToken: string): Promise<Invitation | null> {
  const res = await fetch(`/api/invitations/${encodeURIComponent(publicId)}/manage`, {
    headers: { accept: "application/json", "x-manage-token": manageToken },
  });
  const data = await readJsonBody(res, "The sender view couldn’t be opened.", true);
  if (data == null) return null;
  return asInvitation(data);
}
