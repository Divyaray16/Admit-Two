import { PLAYER_BARS } from "../lib/ticketStyle";

type VoiceNotePlayerProps = {
  playing: boolean;
  progress: number;
  isLoading?: boolean;
  onToggle: () => void;
  size?: "sm" | "lg";
};

export function VoiceNotePlayer({ playing, progress, isLoading = false, onToggle, size = "lg" }: VoiceNotePlayerProps) {
  const button = size === "lg" ? "size-12" : "size-10";
  return (
    <div className="flex w-full items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        className={`${button} flex shrink-0 items-center justify-center rounded-full bg-[#272727] text-white`}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        data-testid={playing ? "button-pause-audio" : "button-play-audio"}
      >
        {isLoading ? (
          <span className="block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : playing ? (
          <svg width="14" height="14" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="1" y="1" width="3" height="8" rx="1" fill="white" />
            <rect x="6" y="1" width="3" height="8" rx="1" fill="white" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <polygon points="6,4 20,12 6,20" fill="white" />
          </svg>
        )}
      </button>
      <div className="flex h-6 flex-1 items-end gap-0.5" aria-hidden="true">
        {PLAYER_BARS.map((height, index) => {
          const filled = progress * PLAYER_BARS.length >= index + 1;
          return (
            <div
              key={index}
              className="flex-1 rounded-full transition-colors duration-100"
              style={{ height, backgroundColor: filled ? "#272727" : "rgba(39, 39, 39, 0.4)" }}
            />
          );
        })}
      </div>
    </div>
  );
}
