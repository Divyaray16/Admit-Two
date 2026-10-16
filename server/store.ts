import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "data", "invitations");
const ID = /^[A-Za-z0-9_-]{8,40}$/;
const TOKEN = /^[A-Za-z0-9_-]{16,200}$/;
const MAX_AUDIO = 2_000_000;

const COLORS = ["green", "white", "pink", "violet", "blue"] as const;
type TicketColor = (typeof COLORS)[number];
type TicketForm = 1 | 2 | 3;
type RsvpStatus = "pending" | "accepted" | "declined";

export class StoreError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "StoreError";
    this.status = status;
  }
}

type AudioInput = {
  mime: string;
  duration: number;
  data: string;
};

type RecordFile = {
  publicId: string;
  manageTokenHash: string;
  senderName: string;
  recipientName: string | null;
  title: string;
  eventDate: string;
  eventTime: string;
  location: string | null;
  message: string;
  note: string | null;
  ticketColor: TicketColor;
  ticketForm: TicketForm;
  audioMime: string | null;
  audioExt: string | null;
  audioDuration: number | null;
  rsvpStatus: RsvpStatus;
  respondedAt: string | null;
  createdAt: string;
};

export type PublicInvitation = {
  publicId: string;
  senderName: string;
  recipientName: string | null;
  title: string;
  eventDate: string;
  eventTime: string;
  location: string | null;
  message: string;
  note: string | null;
  ticketColor: TicketColor;
  ticketForm: TicketForm;
  audioUrl: string | null;
  audioDuration: number | null;
  rsvpStatus: RsvpStatus;
  respondedAt: string | null;
  createdAt: string;
  mode: "live";
};

const chains = new Map<string, Promise<unknown>>();

function withLock<T>(publicId: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(publicId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  chains.set(
    publicId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(token: string, hash: string): boolean {
  const next = Buffer.from(hashToken(token));
  const current = Buffer.from(hash);
  if (next.length !== current.length) return false;
  return timingSafeEqual(next, current);
}

function dirFor(publicId: string): string {
  if (!ID.test(publicId)) throw new StoreError(400, "The invitation id is not valid.");
  const dir = path.resolve(ROOT, publicId);
  if (dir !== path.join(ROOT, publicId)) throw new StoreError(400, "The invitation id is not valid.");
  return dir;
}

function clean(value: string): string {
  return value.split("\u0000").join("").split("\u200b").join("").trim();
}

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = clean(value);
  if (!trimmed) return null;
  if (trimmed.length > max) throw new StoreError(400, "That field is too long.");
  return trimmed;
}

function ticketColor(value: unknown): TicketColor {
  if (value === "white" || value === "pink" || value === "violet" || value === "blue" || value === "green") return value;
  return "green";
}

function ticketForm(value: unknown): TicketForm {
  if (value === 2 || value === 3 || value === "2" || value === "3") return Number(value) as TicketForm;
  return 1;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;
  return hour <= 23 && minute <= 59 && second <= 59;
}

function extensionFor(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

function parseAudio(value: unknown): AudioInput | null {
  if (value == null) return null;
  if (!isRecord(value)) throw new StoreError(400, "The voice message couldn’t be read.");
  const mime = typeof value.mime === "string" ? value.mime.split(";")[0]?.trim().toLowerCase() ?? "" : "";
  if (!mime.startsWith("audio/") || mime.length > 80) throw new StoreError(400, "The voice message couldn’t be read.");
  const duration = typeof value.duration === "number" ? value.duration : Number(value.duration);
  if (!Number.isFinite(duration) || duration < 0 || duration > 900) {
    throw new StoreError(400, "The voice message couldn’t be read.");
  }
  if (typeof value.data !== "string" || value.data.trim().length === 0) {
    throw new StoreError(400, "The voice message couldn’t be read.");
  }
  return { mime, duration: Number(duration.toFixed(2)), data: value.data };
}

function decodeAudio(data: string): Buffer {
  const cleaned = data.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(cleaned)) throw new StoreError(400, "The voice message couldn’t be read.");
  const normalized = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Buffer.from(normalized, "base64");
  if (bytes.length === 0) throw new StoreError(400, "The voice message couldn’t be read.");
  if (bytes.length > MAX_AUDIO) throw new StoreError(413, "That recording is too large. Try a shorter message.");
  return bytes;
}

function toPublic(record: RecordFile): PublicInvitation {
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
    ticketColor: record.ticketColor,
    ticketForm: record.ticketForm,
    audioUrl: record.audioExt ? `/api/audio/${record.publicId}` : null,
    audioDuration: record.audioDuration,
    rsvpStatus: record.rsvpStatus,
    respondedAt: record.respondedAt,
    createdAt: record.createdAt,
    mode: "live",
  };
}

async function readRecord(publicId: string): Promise<RecordFile | null> {
  if (!ID.test(publicId)) return null;
  try {
    const raw = await readFile(path.join(dirFor(publicId), "record.json"), "utf8");
    const parsed = JSON.parse(raw) as RecordFile;
    if (!parsed || parsed.publicId !== publicId) return null;
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeRecord(dir: string, record: RecordFile): Promise<void> {
  const tmp = path.join(dir, `record.json.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(record), "utf8");
  await rename(tmp, path.join(dir, "record.json"));
}

async function writeAudio(dir: string, audio: AudioInput): Promise<{ mime: string; ext: string }> {
  const ext = extensionFor(audio.mime);
  const bytes = decodeAudio(audio.data);
  const filename = `audio.${ext}`;
  const tmp = path.join(dir, `${filename}.${process.pid}.partial`);
  await writeFile(tmp, bytes);
  await rename(tmp, path.join(dir, filename));
  const names = await readdir(dir);
  for (const name of names) {
    if (name.startsWith("audio.") && name !== filename) await rm(path.join(dir, name), { force: true });
  }
  return { mime: audio.mime, ext };
}

function requireId(value: unknown): string {
  if (typeof value !== "string" || !ID.test(value)) throw new StoreError(400, "The invitation id is not valid.");
  return value;
}

function requireToken(value: unknown): string {
  if (typeof value !== "string" || !TOKEN.test(value)) throw new StoreError(400, "The sender key is not valid.");
  return value;
}

async function createUnlocked(body: unknown): Promise<PublicInvitation> {
  if (!isRecord(body)) throw new StoreError(400, "The invitation couldn’t be read.");
  const publicId = requireId(body.publicId);
  const manageToken = requireToken(body.manageToken);
  const senderName = typeof body.senderName === "string" ? clean(body.senderName) : "";
  if (senderName.length > 60) throw new StoreError(400, "Keep your name shorter.");
  const title = typeof body.title === "string" ? clean(body.title) : "";
  if (!title) throw new StoreError(400, "Give the invitation a title.");
  if (title.length > 80) throw new StoreError(400, "Keep the title shorter.");
  const eventDate = typeof body.eventDate === "string" ? body.eventDate.trim() : "";
  const eventTime = typeof body.eventTime === "string" ? body.eventTime.trim() : "";
  if (!isIsoDate(eventDate) || !isTime(eventTime)) throw new StoreError(400, "Choose a date and time.");
  const note = optionalText(body.note, 500);
  const message = optionalText(body.message, 500) ?? note ?? "You're invited.";
  const audio = parseAudio(body.audio);

  await mkdir(ROOT, { recursive: true });
  const dir = dirFor(publicId);
  try {
    await mkdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new StoreError(409, "That invitation already exists.");
    throw error;
  }

  try {
    const savedAudio = audio ? await writeAudio(dir, audio) : null;
    const record: RecordFile = {
      publicId,
      manageTokenHash: hashToken(manageToken),
      senderName,
      recipientName: optionalText(body.recipientName, 60),
      title,
      eventDate,
      eventTime,
      location: optionalText(body.location, 120),
      message,
      note,
      ticketColor: ticketColor(body.ticketColor),
      ticketForm: ticketForm(body.ticketForm),
      audioMime: savedAudio?.mime ?? null,
      audioExt: savedAudio?.ext ?? null,
      audioDuration: audio ? audio.duration : null,
      rsvpStatus: "pending",
      respondedAt: null,
      createdAt: new Date().toISOString(),
    };
    await writeRecord(dir, record);
    return toPublic(record);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

async function attachUnlocked(publicId: string, manageToken: string, body: unknown): Promise<PublicInvitation> {
  if (!isRecord(body)) throw new StoreError(400, "The voice message couldn’t be read.");
  const audio = parseAudio(body.audio ?? body);
  if (!audio) throw new StoreError(400, "The voice message couldn’t be read.");
  const record = await readRecord(publicId);
  if (!record || !tokenMatches(manageToken, record.manageTokenHash)) {
    throw new StoreError(404, "The voice message couldn’t be attached.");
  }
  const saved = await writeAudio(dirFor(publicId), audio);
  record.audioMime = saved.mime;
  record.audioExt = saved.ext;
  record.audioDuration = audio.duration;
  await writeRecord(dirFor(publicId), record);
  return toPublic(record);
}

async function respondUnlocked(publicId: string, status: unknown): Promise<PublicInvitation> {
  if (status !== "accepted" && status !== "declined") throw new StoreError(400, "Choose accept or decline.");
  const record = await readRecord(publicId);
  if (!record) throw new StoreError(404, "This invitation can’t be found.");
  if (record.rsvpStatus === "pending") {
    record.rsvpStatus = status;
    record.respondedAt = new Date().toISOString();
    await writeRecord(dirFor(publicId), record);
  }
  return toPublic(record);
}

export function createInvitation(body: unknown): Promise<PublicInvitation> {
  if (!isRecord(body)) return Promise.reject(new StoreError(400, "The invitation couldn’t be read."));
  let publicId: string;
  try {
    publicId = requireId(body.publicId);
  } catch (error) {
    return Promise.reject(error);
  }
  return withLock(publicId, () => createUnlocked(body));
}

export function attachAudio(publicId: string, manageToken: string, body: unknown): Promise<PublicInvitation> {
  return withLock(publicId, () => attachUnlocked(publicId, manageToken, body));
}

export function getPublic(publicId: string): Promise<PublicInvitation | null> {
  return readRecord(publicId).then((record) => (record ? toPublic(record) : null));
}

export async function getManaged(publicId: string, manageToken: string): Promise<PublicInvitation | null> {
  if (!TOKEN.test(manageToken)) return null;
  const record = await readRecord(publicId);
  if (!record || !tokenMatches(manageToken, record.manageTokenHash)) return null;
  return toPublic(record);
}

export function respond(publicId: string, status: unknown): Promise<PublicInvitation> {
  return withLock(publicId, () => respondUnlocked(publicId, status));
}

export async function readAudio(publicId: string): Promise<{ mime: string; bytes: Buffer } | null> {
  const record = await readRecord(publicId);
  if (!record?.audioExt || !record.audioMime) return null;
  if (!/^(webm|m4a|ogg|wav|mp3)$/.test(record.audioExt)) return null;
  try {
    const bytes = await readFile(path.join(dirFor(publicId), `audio.${record.audioExt}`));
    return { mime: record.audioMime, bytes };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
