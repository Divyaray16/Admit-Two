import { Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatClock } from "../lib/format";
import type { VoiceTake } from "../types";

type RecordingPreviewProps = {
  take: VoiceTake;
  onRerecord: () => void;
  onRemove: () => void;
};

export function RecordingPreview({ take, onRerecord, onRemove }: RecordingPreviewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(take.duration);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio(take.url);
    audio.preload = "auto";
    audioRef.current = audio;
    const onTime = () => setCurrent(audio.currentTime || 0);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration !== Number.POSITIVE_INFINITY) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onError = () => setError("Couldn’t play that recording.");
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [take.url]);

  const total = duration || take.duration;
  const pct = total ? Math.min(100, (current / total) * 100) : 0;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setError(null);
      void audio.play().catch(() => setError("Couldn’t play that recording."));
    } else {
      audio.pause();
    }
  };

  return (
    <div className="border border-[#343434] bg-[#1D1D1D] p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#F5F2ED] text-[#141414]"
          aria-label={playing ? "Pause recording" : "Play recording"}
          onClick={toggle}
        >
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="translate-x-px" />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            className="dark-range"
            style={{ ["--pct" as string]: `${pct}%` }}
            type="range"
            min={0}
            max={total || 0}
            step={0.1}
            value={Math.min(current, total || 0)}
            aria-label="Seek recording"
            aria-valuetext={`${formatClock(current)} of ${formatClock(total)}`}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (audioRef.current) audioRef.current.currentTime = next;
              setCurrent(next);
            }}
          />
          <div className="mt-1 flex justify-between font-sans text-xs text-[#AAA9A6] tabular-nums">
            <span>{formatClock(current)}</span>
            <span>{formatClock(total)}</span>
          </div>
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-[#D7B2AA]" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-sm text-[#AAA9A6]">Listen before you send it.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={onRerecord}>
          <RotateCcw size={16} />
          Re-record
        </button>
        <button type="button" className="btn btn-secondary" onClick={onRemove}>
          <Trash2 size={16} />
          Remove
        </button>
      </div>
    </div>
  );
}
