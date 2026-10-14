import type { Invitation, InvitationDraft, RsvpStatus } from "../types";
import { emptyToNull } from "./format";

type DemoRecord = {
  publicId: string;
  manageToken: string;
  senderName: string;
  recipientName: string | null;
  title: string;
  eventDate: string;
  eventTime: string;
  location: string | null;
  message: string;
  note: string | null;
  audioDuration: number | null;
  hasAudio: boolean;
  rsvpStatus: RsvpStatus;
  respondedAt: string | null;
  createdAt: string;
};

const KEY = "admittwo.invitations.v1";
const DB_NAME = "admittwo";
const STORE = "audio";
const urlCache = new Map<string, string>();

function readAll(): DemoRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemoRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(records: DemoRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(records));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local audio storage."));
  });
}

async function putAudio(publicId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, publicId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the recording on this browser."));
  });
  db.close();
  const previous = urlCache.get(publicId);
  if (previous) URL.revokeObjectURL(previous);
  urlCache.set(publicId, URL.createObjectURL(blob));
}

async function audioUrl(publicId: string, hasAudio: boolean): Promise<string | null> {
  if (!hasAudio) return null;
  const cached = urlCache.get(publicId);
  if (cached) return cached;
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(publicId);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read the recording."));
  });
  db.close();
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(publicId, url);
  return url;
}

async function toInvitation(record: DemoRecord): Promise<Invitation> {
  return {
    publicId: record.publicId,
    senderName: record.senderName,
    recipientName: record.recipientName,
    title: record.title,
    eventDate: record.eventDate,
    eventTime: record.eventTime,
    location: record.location,
    message: record.message,
    note: record.note,
    audioUrl: await audioUrl(record.publicId, record.hasAudio),
    audioDuration: record.audioDuration,
    rsvpStatus: record.rsvpStatus,
    respondedAt: record.respondedAt,
    createdAt: record.createdAt,
    mode: "demo",
  };
}

export async function demoCreate(
  draft: InvitationDraft,
  publicId: string,
  manageToken: string,
): Promise<void> {
  if (draft.audio) await putAudio(publicId, draft.audio.blob);
  const record: DemoRecord = {
    publicId,
    manageToken,
    senderName: draft.senderName.trim(),
    recipientName: emptyToNull(draft.recipientName),
    title: draft.title.trim(),
    eventDate: draft.eventDate,
    eventTime: draft.eventTime,
    location: emptyToNull(draft.location),
    message: draft.message.trim(),
    note: emptyToNull(draft.note),
    audioDuration: draft.audio ? draft.audio.duration : null,
    hasAudio: Boolean(draft.audio),
    rsvpStatus: "pending",
    respondedAt: null,
    createdAt: new Date().toISOString(),
  };
  writeAll([record, ...readAll().filter((item) => item.publicId !== publicId)]);
}

export async function demoGetPublic(publicId: string): Promise<Invitation | null> {
  const record = readAll().find((item) => item.publicId === publicId);
  if (!record) return null;
  return toInvitation(record);
}

export async function demoGetManaged(publicId: string, manageToken: string): Promise<Invitation | null> {
  const record = readAll().find((item) => item.publicId === publicId && item.manageToken === manageToken);
  if (!record) return null;
  return toInvitation(record);
}

export async function demoRespond(publicId: string, status: Exclude<RsvpStatus, "pending">): Promise<Invitation | null> {
  const records = readAll();
  const index = records.findIndex((item) => item.publicId === publicId);
  if (index < 0) return null;
  const current = records[index];
  if (!current) return null;
  if (current.rsvpStatus === "pending") {
    records[index] = {
      ...current,
      rsvpStatus: status,
      respondedAt: new Date().toISOString(),
    };
    writeAll(records);
  }
  return toInvitation(records[index] ?? current);
}
