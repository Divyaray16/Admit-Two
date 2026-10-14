import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTicketAudio } from "../hooks/useTicketAudio";
import { formatEventDate, formatEventTime, validateDraft } from "../lib/format";
import { isLive } from "../lib/mode";
import { createInvitation, InvitationSaveError } from "../lib/repository";
import { EMPTY_DRAFT, SAMPLE_PREVIEW, type CreatedInvitation, type FieldErrors, type InvitationDraft, type VoiceTake } from "../types";
import { InvitationForm } from "./InvitationForm";
import { usePageTitle } from "../hooks/usePageTitle";
import { AppShell, ModeChip, TicketFooter } from "./SiteChrome";
import { Ticket, type TicketPlayback } from "./Ticket";
import { VoiceRecorder } from "./VoiceRecorder";

export function InvitationComposer() {
  usePageTitle("AdmitTwo — Make an invitation");
  const navigate = useNavigate();
  const [draft, setDraft] = useState<InvitationDraft>(EMPTY_DRAFT);
  const [dirty, setDirty] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<"idle" | "saving" | "uploading" | "error">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const createdRef = useRef<CreatedInvitation | null>(null);

  const onAudio = useCallback((audio: VoiceTake | null) => {
    setDraft((current) => ({ ...current, audio }));
    if (audio) setDirty(true);
  }, []);

  const preview = dirty
    ? {
        senderName: draft.senderName.trim() || "You",
        title: draft.title.trim() || "Your invitation",
        eventDate: draft.eventDate,
        eventTime: draft.eventTime,
        note: draft.note.trim(),
        location: draft.location.trim(),
      }
    : { ...SAMPLE_PREVIEW, location: "" };

  const audio = useTicketAudio(draft.audio?.url ?? null, draft.audio?.duration ?? 0);
  const showSampleMark = !dirty && !draft.audio;
  const playback = useMemo<TicketPlayback>(
    () => ({
      expanded: audio.expanded,
      playing: audio.playing,
      currentTime: audio.currentTime,
      duration: audio.duration,
      error: audio.error,
      openLabel: showSampleMark ? "Record a voice message to open the sample ticket" : undefined,
      onOpen: showSampleMark
        ? () => document.getElementById("voice-heading")?.scrollIntoView({ behavior: "smooth", block: "center" })
        : audio.open,
      onToggle: audio.toggle,
      onSeek: audio.seek,
      onReplay: () => void audio.replay(),
      onCollapse: audio.collapse,
      onRetry: () => void audio.retry(),
    }),
    [audio, showSampleMark],
  );

  const onChange = (patch: Partial<InvitationDraft>) => {
    setDirty(true);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const onCreate = async () => {
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setShowErrors(true);
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      });
      return;
    }

    setFormError(null);
    setPhase(draft.audio && !createdRef.current ? "saving" : createdRef.current ? "uploading" : "saving");
    try {
      if (createdRef.current && draft.audio) setPhase("uploading");
      const created = await createInvitation(draft, createdRef.current);
      createdRef.current = created;
      navigate(`/sent/${created.publicId}`);
    } catch (error) {
      if (error instanceof InvitationSaveError && error.created) createdRef.current = error.created;
      setPhase("error");
      setFormError(error instanceof Error ? error.message : "The invitation couldn’t be saved.");
    }
  };

  return (
    <AppShell
      descriptor="Personal invitations, made personal."
      eyebrow={
        <div className="flex items-center gap-3">
          <a href="/manage" className="text-sm text-[#AAA9A6] underline decoration-[#343434] underline-offset-4">
            Responses
          </a>
          <ModeChip />
        </div>
      }
    >
      <div className="grid min-w-0 items-start gap-12 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:gap-16">
        <div className="order-2 min-w-0 lg:order-1">
          <h1 className="font-serif text-5xl leading-[0.95] text-[#F5F2ED] md:text-6xl">Make it an invitation.</h1>
          <p className="mt-4 max-w-md text-lg text-[#AAA9A6]">
            Write a little note. Add your voice. Send something worth opening.
          </p>
          {!isLive ? (
            <p className="mt-4 max-w-md text-sm text-[#8C877A]">
              Demo mode. Invitations stay in this browser until Supabase is connected.
            </p>
          ) : null}

          <form
            className="mt-10"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void onCreate();
            }}
          >
            <InvitationForm draft={draft} errors={errors} showErrors={showErrors} onChange={onChange} />
            <VoiceRecorder onChange={onAudio} busy={phase === "saving" || phase === "uploading"} />
            <div className="mt-8">
              {formError ? (
                <p className="mb-3 text-sm text-[#D7B2AA]" role="alert">
                  {formError}
                </p>
              ) : (
                <p className="mb-3 text-sm text-[#6F6E6B]">
                  {draft.audio ? `Voice message ready · ${Math.round(draft.audio.duration)}s` : "You can send this without a voice message."}
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={phase === "saving" || phase === "uploading"}>
                {phase === "saving" ? "Saving invitation…" : phase === "uploading" ? "Uploading voice…" : phase === "error" ? "Try again" : "Create invitation"}
              </button>
            </div>
          </form>
        </div>

        <div className="order-1 min-w-0 lg:sticky lg:top-6 lg:order-2">
          <p className="mb-4 text-center font-sans text-[11px] tracking-[0.18em] text-[#6F6E6B] lg:text-left">
            {dirty ? "LIVE PREVIEW" : "SAMPLE TICKET"}
          </p>
          <Ticket
            content={{
              senderName: preview.senderName,
              title: preview.title,
              dateLabel: formatEventDate(preview.eventDate),
              timeLabel: formatEventTime(preview.eventTime),
              note: preview.note || undefined,
              location: preview.location || undefined,
            }}
            hasAudio={Boolean(draft.audio) || showSampleMark}
            playback={draft.audio || showSampleMark ? playback : undefined}
          />
          {dirty && draft.message.trim() ? (
            <p className="mx-auto mt-6 max-w-md text-center text-sm leading-relaxed text-[#AAA9A6]">{draft.message.trim()}</p>
          ) : null}
        </div>
      </div>
      <TicketFooter />
    </AppShell>
  );
}
