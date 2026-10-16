import { useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { usePageTitle } from "../hooks/usePageTitle";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { consumeEditDraft, saveCreateDraft } from "../lib/draftSession";
import { isPastTimeToday, validateDraft } from "../lib/format";
import { createInvitation, InvitationSaveError } from "../lib/repository";
import { TICKET_COLORS } from "../lib/ticketStyle";
import { EMPTY_DRAFT, type CreatedInvitation, type FieldErrors, type InvitationDraft, type TicketForm } from "../types";
import { PageFrame } from "./SiteChrome";
import { ScaledBox } from "./ScaledBox";
import { Ticket } from "./Ticket";
import { DateField, TimeField } from "./WhenPickers";
import { VoiceNotePlayer } from "./VoiceNotePlayer";

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

export function InvitationComposer() {
  usePageTitle("Design your ticket · Admit Two");
  const navigate = useNavigate();
  const restored = useMemo(() => consumeEditDraft(), []);
  const [draft, setDraft] = useState<InvitationDraft>(() =>
    restored ? { ...EMPTY_DRAFT, ...restored, audio: null } : EMPTY_DRAFT,
  );
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<"idle" | "saving" | "uploading" | "error">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const recorder = useVoiceRecorder();
  const player = useAudioPlayer(recorder.take?.url ?? null, recorder.take?.duration ?? 0);
  const progress = player.duration > 0 ? Math.min(1, player.currentTime / player.duration) : 0;
  const ready = Boolean(draft.title.trim() && draft.eventDate && draft.eventTime && draft.note.trim());
  const busy = phase === "saving" || phase === "uploading";

  const patch = (next: Partial<InvitationDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const onCreate = async () => {
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    setShowErrors(true);
    if (Object.keys(nextErrors).length > 0) return;

    setFormError(null);
    setPhase(created && recorder.take ? "uploading" : "saving");
    const payload: InvitationDraft = { ...draft, audio: recorder.take };
    try {
      const result = await createInvitation(payload, created);
      setCreated(result);
      saveCreateDraft({
        title: draft.title,
        eventDate: draft.eventDate,
        eventTime: draft.eventTime,
        note: draft.note,
        senderName: draft.senderName,
        ticketColor: draft.ticketColor,
        ticketForm: draft.ticketForm,
      });
      navigate(`/sent/${result.publicId}`);
    } catch (error) {
      if (error instanceof InvitationSaveError && error.created) setCreated(error.created);
      setPhase("error");
      setFormError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <PageFrame backHref="/">
      <div className="sticky top-0 z-40 border-b border-[#2a2a2a] bg-[#141414] py-3">
        <ScaledBox width={354} height={212}>
          <Ticket
            data={{
              title: draft.title,
              date: draft.eventDate,
              time: draft.eventTime,
              note: draft.note,
            }}
            color={draft.ticketColor}
            form={draft.ticketForm}
            senderName={draft.senderName}
            hasAudio={Boolean(recorder.take)}
            audio={
              recorder.take
                ? { playing: player.playing, progress, isLoading: false, toggle: player.toggle }
                : null
            }
          />
        </ScaledBox>
      </div>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-6 px-5 pt-6 pb-24">
        <div className="w-full">
          <h1 className="mb-1 font-serif text-2xl text-[#F5F2ED]">Design your ticket</h1>
        </div>

        <form
          className="flex w-full flex-col gap-[19px]"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void onCreate();
          }}
        >
          <div className="flex items-start gap-[19px]">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="font-inter text-[12px] font-semibold text-[#A3A3A3] uppercase">color</span>
              <div className="flex h-6 items-center gap-2">
                {TICKET_COLORS.map((swatch) => (
                  <button
                    key={swatch.key}
                    type="button"
                    aria-label={swatch.key}
                    aria-pressed={draft.ticketColor === swatch.key}
                    onClick={() => patch({ ticketColor: swatch.key })}
                    className="size-6 rounded-full border-2 border-[#e9e9e9]"
                    style={{
                      backgroundColor: swatch.bg,
                      boxShadow: draft.ticketColor === swatch.key ? "0 0 0 2px #F5F2ED" : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="font-inter text-[12px] font-semibold text-[#A3A3A3] uppercase">type</span>
              <div className="flex items-center gap-2">
                {([1, 2, 3] as TicketForm[]).map((form) => (
                  <button
                    key={form}
                    type="button"
                    aria-label={`Type ${form}`}
                    aria-pressed={draft.ticketForm === form}
                    onClick={() => patch({ ticketForm: form })}
                    className={`h-6 w-10 overflow-hidden rounded-[4px] transition ${
                      draft.ticketForm === form
                        ? "ring-2 ring-[#F5F2ED] ring-offset-1 ring-offset-[#141414]"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img alt="" className="block size-full object-contain" src={`/figmaAssets/type_${form}.svg`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Field
            label="event title"
            required
            value={draft.title}
            max={30}
            placeholder="Sunset picnic over the city"
            error={showErrors ? errors.title : undefined}
            onChange={(title) => patch({ title: title.slice(0, 30) })}
          />

          <div className="flex gap-[19px]">
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex gap-0.5 font-inter text-[12px] font-semibold uppercase">
                <span className="text-[#A3A3A3]">date</span>
                <span className="text-[#F5F2ED]">*</span>
              </div>
              <DateField
                value={draft.eventDate}
                invalid={Boolean(showErrors && errors.eventDate)}
                onChange={(eventDate) => {
                  if (draft.eventTime && isPastTimeToday(eventDate, draft.eventTime)) {
                    patch({ eventDate, eventTime: "" });
                    return;
                  }
                  patch({ eventDate });
                }}
              />
              {showErrors && errors.eventDate ? (
                <p className="font-inter text-sm text-red-400">{errors.eventDate}</p>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex gap-0.5 font-inter text-[12px] font-semibold uppercase">
                <span className="text-[#A3A3A3]">time</span>
                <span className="text-[#F5F2ED]">*</span>
              </div>
              <TimeField
                value={draft.eventTime}
                date={draft.eventDate}
                invalid={Boolean(showErrors && errors.eventTime)}
                onChange={(eventTime) => patch({ eventTime })}
              />
              {showErrors && errors.eventTime ? (
                <p className="font-inter text-sm text-red-400">{errors.eventTime}</p>
              ) : null}
            </div>
          </div>

          <Field
            label="note"
            required
            value={draft.note}
            max={34}
            multiline
            placeholder="See you at golden hour"
            error={showErrors ? errors.note : undefined}
            onChange={(note) => patch({ note: note.slice(0, 34) })}
          />

          <Field
            label="your name (optional)"
            value={draft.senderName}
            max={20}
            placeholder="Divya Ray"
            error={showErrors ? errors.senderName : undefined}
            onChange={(senderName) => patch({ senderName: senderName.slice(0, 20) })}
          />

          <div className="flex flex-col gap-1.5">
            <span className="font-inter text-[12px] font-semibold tracking-wide text-[#A3A3A3] uppercase">
              Voice note (optional)
            </span>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
              {recorder.status !== "recording" && recorder.status !== "requesting" && recorder.status !== "processing" && !recorder.take ? (
                <>
                  <div className="flex size-14 items-center justify-center rounded-full bg-[#f9f7f2]">
                    <MicIcon />
                  </div>
                  <p className="text-center font-sans text-sm text-[#7d7d7d]">Record a personal message for your date</p>
                  <button
                    type="button"
                    onClick={() => void recorder.start()}
                    disabled={busy}
                    className="rounded-full bg-[#272727] px-6 py-2.5 font-sans text-sm font-semibold text-white"
                  >
                    Tap to record
                  </button>
                </>
              ) : null}

              {recorder.status === "recording" || recorder.status === "requesting" || recorder.status === "processing" ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
                    <span className="font-sans text-sm font-semibold text-red-500">
                      {recorder.status === "recording" ? `Recording ${clock(recorder.elapsed)}` : "Recording 00:00"}
                    </span>
                  </div>
                  <div className="flex h-8 items-end gap-1" aria-hidden="true">
                    {recorder.levels.slice(-20).map((level, index) => (
                      <div
                        key={index}
                        className="w-1 rounded-full bg-[#272727]"
                        style={{ height: `${8 + level * 22}px` }}
                      />
                    ))}
                  </div>
                  {recorder.status === "recording" ? (
                    <button
                      type="button"
                      onClick={recorder.stop}
                      className="rounded-full border-2 border-red-500 px-6 py-2.5 font-sans text-sm font-semibold text-red-500"
                    >
                      Stop recording
                    </button>
                  ) : null}
                </>
              ) : null}

              {recorder.take && recorder.status !== "recording" ? (
                <>
                  <div className="flex w-full items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <VoiceNotePlayer playing={player.playing} progress={progress} onToggle={player.toggle} size="sm" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        player.pause();
                        recorder.reset();
                      }}
                      className="shrink-0 font-sans text-xs text-[#272727] underline"
                    >
                      Re-record
                    </button>
                  </div>
                  <p className="font-sans text-xs text-[#7d7d7d]">Voice note ready ✓</p>
                </>
              ) : null}
            </div>
            {recorder.detail ? <p className="font-inter text-sm text-red-400">{recorder.detail}</p> : null}
          </div>

          {formError ? <p className="text-center font-inter text-sm text-red-400">{formError}</p> : null}

          <button
            type="submit"
            disabled={busy || !ready}
            className="flex w-full items-center justify-center rounded-full bg-[#F5F2ED] px-[18px] py-3.5 font-sans text-base font-semibold text-[#141414] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {phase === "saving" || phase === "uploading" ? "Generating…" : "Get my shareable link →"}
          </button>
        </form>
      </main>
    </PageFrame>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  max,
  required,
  multiline,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  max?: number;
  required?: boolean;
  multiline?: boolean;
  error?: string;
}) {
  const shared = {
    value,
    placeholder,
    maxLength: max,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    className: "paper-field",
    "aria-invalid": Boolean(error),
  };
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <div className="flex items-start justify-between">
        <div className="flex gap-0.5 font-inter text-[12px] font-semibold uppercase">
          <span className="text-[#A3A3A3]">{label}</span>
          {required ? <span className="text-[#F5F2ED]">*</span> : null}
        </div>
        {max != null ? (
          <span className="font-inter text-[12px] font-semibold text-[#8a8a8a] uppercase">
            {value.length}/{max}
          </span>
        ) : null}
      </div>
      {multiline ? <textarea {...shared} rows={2} /> : <input {...shared} type="text" />}
      {error ? <p className="font-inter text-sm text-red-400">{error}</p> : null}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="#272727" />
      <path d="M5 10a7 7 0 0 0 14 0" stroke="#272727" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="21" stroke="#272727" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
