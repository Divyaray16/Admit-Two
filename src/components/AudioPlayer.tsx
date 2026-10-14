import { RotateCcw } from "lucide-react";
import { formatClock } from "../lib/format";

type AudioPlayerProps = {
  currentTime: number;
  duration: number;
  error: string | null;
  onSeek: (time: number) => void;
  onReplay: () => void;
  onCollapse: () => void;
  onRetry: () => void;
};

export function AudioPlayer({
  currentTime,
  duration,
  error,
  onSeek,
  onReplay,
  onCollapse,
  onRetry,
}: AudioPlayerProps) {
  const total = duration > 0 ? duration : 0;
  const pct = total ? Math.min(100, (currentTime / total) * 100) : 0;

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-[#C5CCD6] pt-3">
        <p className="text-[13px] text-[#6d4d48]" role="alert">
          {error}
        </p>
        <button type="button" className="text-[12px] tracking-[0.14em] text-[#2C3138] uppercase" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-[#C5CCD6] pt-3">
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 font-sans text-[13px] text-[#5C6672] tabular-nums">
          {formatClock(currentTime)}
        </span>
        <input
          className="ticket-range"
          style={{ ["--pct" as string]: `${pct}%` }}
          type="range"
          min={0}
          max={total || 0}
          step={0.1}
          value={Math.min(currentTime, total || 0)}
          aria-label="Seek voice message"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${formatClock(currentTime)} of ${formatClock(total)}`}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span className="w-10 shrink-0 text-right font-sans text-[13px] text-[#5C6672] tabular-nums">
          {formatClock(total)}
        </span>
        <button
          type="button"
          className="grid h-9 w-9 shrink-0 place-items-center text-[#2C3138]"
          aria-label="Replay voice message"
          onClick={onReplay}
        >
          <RotateCcw size={15} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="shrink-0 px-1 py-2 font-sans text-[12px] tracking-[0.16em] text-[#5C6672] uppercase"
          onClick={onCollapse}
        >
          Close
        </button>
      </div>
    </div>
  );
}
