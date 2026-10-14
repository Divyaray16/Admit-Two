type AudioAttachmentProps = {
  expanded: boolean;
  playing: boolean;
  senderName: string;
  openLabel?: string;
  onOpen: () => void;
  onToggle: () => void;
};

export function AudioAttachment({ expanded, playing, senderName, openLabel, onOpen, onToggle }: AudioAttachmentProps) {
  const label = !expanded
    ? (openLabel ?? `Open the voice message from ${senderName}`)
    : playing
      ? "Pause voice message"
      : "Play voice message";

  return (
    <button
      type="button"
      className="grid h-[62px] w-[62px] place-items-center rounded-full border-[1.75px] border-[#3A4048] bg-[#DFE1E4] text-[#2C3138] transition-colors hover:bg-[#d5dae0]"
      aria-label={label}
      aria-expanded={expanded}
      onClick={expanded ? onToggle : onOpen}
    >
      {!expanded ? <UpTriangle /> : playing ? <PauseBars /> : <PlayTriangle />}
    </button>
  );
}

function UpTriangle() {
  return (
    <svg width="15" height="13" viewBox="0 0 15 13" aria-hidden="true">
      <path d="M7.5 1.2 13.4 12H1.6L7.5 1.2Z" fill="currentColor" />
    </svg>
  );
}

function PlayTriangle() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
      <path d="M2 1.2v13.6L13 8 2 1.2Z" fill="currentColor" />
    </svg>
  );
}

function PauseBars() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="2" y="1.5" width="3.2" height="11" rx="0.6" fill="currentColor" />
      <rect x="8.8" y="1.5" width="3.2" height="11" rx="0.6" fill="currentColor" />
    </svg>
  );
}
