import type { CreatedInvitation, Invitation, InvitationDraft, RsvpStatus } from "../types";

export class InvitationSaveError extends Error {
  created: CreatedInvitation | null;

  constructor(message: string, created: CreatedInvitation | null) {
    super(message);
    this.name = "InvitationSaveError";
    this.created = created;
  }
}
import { demoCreate, demoGetManaged, demoGetPublic, demoRespond } from "./demoStore";
import { emptyToNull } from "./format";
import { newManageToken, newPublicId } from "./ids";
import { isLive } from "./mode";
import { findRegistryEntry, rememberInvitation } from "./registry";
import { supabase } from "./supabase";

type InvitationRow = {
  public_id: string;
  sender_name: string;
  recipient_name: string | null;
  title: string;
  event_date: string;
  event_time: string;
  location: string | null;
  message: string;
  note: string | null;
  audio_path: string | null;
  audio_duration: number | string | null;
  rsvp_status: RsvpStatus;
  responded_at: string | null;
  created_at: string;
};

function asError(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message) return new Error(error.message);
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return new Error(error.message);
  }
  return new Error(fallback);
}

function isRow(value: unknown): value is InvitationRow {
  return Boolean(value && typeof value === "object" && "public_id" in value && "title" in value);
}

function audioPublicUrl(path: string | null): string | null {
  if (!path || !supabase) return null;
  const { data } = supabase.storage.from("invitation-audio").getPublicUrl(path);
  return data.publicUrl || null;
}

function mapRow(row: InvitationRow, mode: Invitation["mode"]): Invitation {
  const duration = row.audio_duration == null ? null : Number(row.audio_duration);
  return {
    publicId: row.public_id,
    senderName: row.sender_name,
    recipientName: row.recipient_name,
    title: row.title,
    eventDate: row.event_date,
    eventTime: row.event_time,
    location: row.location,
    message: row.message,
    note: row.note,
    audioUrl: audioPublicUrl(row.audio_path),
    audioDuration: duration != null && Number.isFinite(duration) ? duration : null,
    rsvpStatus: row.rsvp_status,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
    mode,
  };
}

function extensionFor(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

async function uploadAudio(publicId: string, draft: InvitationDraft): Promise<string | null> {
  if (!draft.audio || !supabase) return null;
  if (draft.audio.blob.size > 2_000_000) {
    throw new Error("That recording is too large. Try a shorter message.");
  }
  const path = `${publicId}/${crypto.randomUUID()}.${extensionFor(draft.audio.mime)}`;
  const { error } = await supabase.storage.from("invitation-audio").upload(path, draft.audio.blob, {
    contentType: draft.audio.mime || "audio/webm",
    upsert: false,
  });
  if (error) throw new Error("The voice message didn’t upload. You can try again.");
  return path;
}

async function attachLiveAudio(created: CreatedInvitation, draft: InvitationDraft): Promise<void> {
  if (!draft.audio || !supabase) return;
  try {
    const path = await uploadAudio(created.publicId, draft);
    const { error } = await supabase.rpc("attach_audio", {
      p_public_id: created.publicId,
      p_manage_token: created.manageToken,
      p_audio_path: path,
      p_audio_duration: Number(draft.audio.duration.toFixed(2)),
    });
    if (error) throw error;
  } catch (error) {
    if (error instanceof InvitationSaveError) throw error;
    throw new InvitationSaveError(
      error instanceof Error && error.message.includes("too large")
        ? error.message
        : "The voice message didn’t upload. You can try again.",
      created,
    );
  }
}

export async function createInvitation(
  draft: InvitationDraft,
  existing?: CreatedInvitation | null,
): Promise<CreatedInvitation> {
  if (existing) {
    if (existing.mode === "live") await attachLiveAudio(existing, draft);
    return existing;
  }

  const publicId = newPublicId();
  const manageToken = newManageToken();

  if (!isLive || !supabase) {
    try {
      await demoCreate(draft, publicId, manageToken);
    } catch (error) {
      throw new InvitationSaveError(
        error instanceof Error ? error.message : "The invitation couldn’t be saved on this browser.",
        null,
      );
    }
    const created: CreatedInvitation = { publicId, manageToken, mode: "demo" };
    rememberInvitation({ publicId, manageToken, mode: "demo", createdAt: new Date().toISOString() });
    return created;
  }

  const { error } = await supabase.rpc("create_invitation", {
    p_public_id: publicId,
    p_manage_token: manageToken,
    p_sender_name: draft.senderName.trim(),
    p_recipient_name: emptyToNull(draft.recipientName),
    p_title: draft.title.trim(),
    p_event_date: draft.eventDate,
    p_event_time: draft.eventTime,
    p_location: emptyToNull(draft.location),
    p_message: draft.message.trim(),
    p_note: emptyToNull(draft.note),
  });
  if (error) throw new InvitationSaveError(asError(error, "The invitation couldn’t be saved.").message, null);

  const created: CreatedInvitation = { publicId, manageToken, mode: "live" };
  rememberInvitation({ publicId, manageToken, mode: "live", createdAt: new Date().toISOString() });
  if (draft.audio) await attachLiveAudio(created, draft);
  return created;
}

export async function getPublicInvitation(publicId: string): Promise<Invitation | null> {
  if (isLive && supabase) {
    const { data, error } = await supabase.rpc("get_invitation", { p_public_id: publicId });
    if (error) throw asError(error, "The invitation couldn’t be opened.");
    if (isRow(data)) return mapRow(data, "live");
  }
  return demoGetPublic(publicId);
}

export async function respondToInvitation(
  publicId: string,
  status: Exclude<RsvpStatus, "pending">,
): Promise<Invitation> {
  const demo = await demoGetPublic(publicId);
  if (demo && (!isLive || demo.mode === "demo")) {
    const saved = await demoRespond(publicId, status);
    if (!saved) throw new Error("This invitation can’t be found on this browser.");
    return saved;
  }

  if (!supabase) throw new Error("This invitation can’t be found.");
  const { data, error } = await supabase.rpc("respond_invitation", {
    p_public_id: publicId,
    p_status: status,
  });
  if (error) throw asError(error, "The reply couldn’t be saved.");
  if (!isRow(data)) throw new Error("This invitation can’t be found.");
  return mapRow(data, "live");
}

export async function getManagedInvitation(publicId: string, manageToken: string): Promise<Invitation | null> {
  const entry = findRegistryEntry(publicId);
  const mode = entry?.mode;

  if (mode !== "live") {
    const demo = await demoGetManaged(publicId, manageToken);
    if (demo) return demo;
    if (!isLive) return null;
  }

  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_managed_invitation", {
    p_public_id: publicId,
    p_manage_token: manageToken,
  });
  if (error) throw asError(error, "The sender view couldn’t be opened.");
  if (!isRow(data)) return null;
  return mapRow(data, "live");
}
