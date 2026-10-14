import { useReducedMotion } from "framer-motion";
import { Mic, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { formatClock } from "../lib/format";
import type { VoiceTake } from "../types";
import { RecordingPreview } from "./RecordingPreview";

type VoiceRecorderProps = {
  onChange: (take: VoiceTake | null) => void;
  busy?: boolean;
};

export function VoiceRecorder({ onChange, busy = false }: VoiceRecorderProps) {
  const reduce = useReducedMotion();
  const recorder = useVoiceRecorder();
  const firstSync = useRef(true);

  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      if (!recorder.take) return;
    }
    onChange(recorder.take);
  }, [onChange, recorder.take]);

  return (
    <section className="mt-10" aria-labelledby="voice-heading">
      <h2 id="voice-heading" className="font-serif text-[2rem] leading-none text-[#F5F2ED]">
        Add your voice.
      </h2>
      <p className="mt-3 max-w-md text-[#AAA9A6]">Some things are better heard than read.</p>

      <div className="mt-6" aria-live="polite">
        {recorder.status === "recording" || recorder.status === "processing" || recorder.status === "requesting" ? (
          <div className="border border-[#343434] bg-[#1D1D1D] p-4">
            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full bg-[#C45C4A] ${recorder.status === "recording" && !reduce ? "animate-pulse" : ""}`}
              />
              <p className="text-sm text-[#F5F2ED]">
                {recorder.status === "requesting"
                  ? "Asking for the microphone…"
                  : recorder.status === "processing"
                    ? "Preparing your recording…"
                    : "Recording"}
              </p>
              <p className="ml-auto font-sans text-sm text-[#AAA9A6] tabular-nums">
                {formatClock(recorder.elapsed)} / {formatClock(recorder.maxSeconds)}
              </p>
            </div>
            <div className="mt-4 flex h-10 items-end gap-1" aria-hidden="true">
              {recorder.levels.map((level, index) => (
                <span
                  key={index}
                  className="w-1.5 rounded-full bg-[#F5F2ED]"
                  style={{ height: `${Math.max(12, level * 100)}%`, opacity: 0.35 + level * 0.65 }}
                />
              ))}
            </div>
            {recorder.status === "recording" ? (
              <button type="button" className="btn btn-primary mt-4" onClick={recorder.stop}>
                <Square size={14} fill="currentColor" />
                Stop
              </button>
            ) : null}
          </div>
        ) : null}

        {recorder.status === "ready" && recorder.take ? (
          <RecordingPreview
            take={recorder.take}
            onRerecord={() => {
              onChange(null);
              recorder.rerecord();
            }}
            onRemove={() => {
              recorder.reset();
              onChange(null);
            }}
          />
        ) : null}

        {recorder.status === "idle" || recorder.status === "denied" || recorder.status === "no-device" || recorder.status === "unsupported" ? (
          <div>
            {recorder.detail ? (
              <p className="mb-4 max-w-md text-sm text-[#D7B2AA]" role="alert">
                {recorder.detail}
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void recorder.start()}
            >
              <Mic size={18} strokeWidth={1.75} />
              {recorder.status === "idle" ? "Record a voice message" : "Try again"}
            </button>
            <p className="mt-3 text-sm text-[#6F6E6B]">Up to 90 seconds. No file uploads.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
