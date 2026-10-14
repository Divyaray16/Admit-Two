import { AudioAttachment } from "./AudioAttachment";
import { NotchedFrame } from "./NotchedFrame";

type TicketStubProps = {
  hasAudio: boolean;
  expanded: boolean;
  playing: boolean;
  senderName: string;
  openLabel?: string;
  onOpen?: () => void;
  onToggle?: () => void;
};

export function TicketStub({ hasAudio, expanded, playing, senderName, openLabel, onOpen, onToggle }: TicketStubProps) {
  return (
    <div className="relative flex w-[124px] shrink-0 flex-col items-center">
      <NotchedFrame inset={11} radius={20} />
      <div className="relative z-[1] mt-[52px] flex flex-col items-center gap-[9px]" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} className="block h-[7px] w-[32px] rounded-full bg-[#C5CAD1]" />
        ))}
      </div>
      <div className="relative z-[1] mt-auto mb-[26px]">
        {hasAudio && onOpen && onToggle ? (
          <AudioAttachment
            expanded={expanded}
            playing={playing}
            senderName={senderName}
            openLabel={openLabel}
            onOpen={onOpen}
            onToggle={onToggle}
          />
        ) : (
          <span className="block h-[62px] w-[62px]" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
