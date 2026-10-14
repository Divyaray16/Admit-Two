export type RsvpStatus = "pending" | "accepted" | "declined";

export type AppMode = "demo" | "live";

export type VoiceTake = {
  blob: Blob;
  url: string;
  duration: number;
  mime: string;
};

export type InvitationDraft = {
  senderName: string;
  recipientName: string;
  title: string;
  eventDate: string;
  eventTime: string;
  location: string;
  message: string;
  note: string;
  audio: VoiceTake | null;
};

export type Invitation = {
  publicId: string;
  senderName: string;
  recipientName: string | null;
  title: string;
  eventDate: string;
  eventTime: string;
  location: string | null;
  message: string;
  note: string | null;
  audioUrl: string | null;
  audioDuration: number | null;
  rsvpStatus: RsvpStatus;
  respondedAt: string | null;
  createdAt: string;
  mode: AppMode;
};

export type CreatedInvitation = {
  publicId: string;
  manageToken: string;
  mode: AppMode;
};

export const EMPTY_DRAFT: InvitationDraft = {
  senderName: "",
  recipientName: "",
  title: "",
  eventDate: "",
  eventTime: "",
  location: "",
  message: "",
  note: "",
  audio: null,
};

export const SAMPLE_PREVIEW = {
  senderName: "Ira",
  title: "movie night, just us two",
  eventDate: "2026-09-03",
  eventTime: "20:00",
  note: "I'll bring the popcorn.",
};

export type FieldErrors = Partial<Record<keyof Omit<InvitationDraft, "audio">, string>>;
