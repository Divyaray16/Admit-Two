import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { TicketColor, TicketForm } from "../lib/ticketStyle";
import { STUB_BARS, ticketAsset } from "../lib/ticketStyle";
import { ticketDateLabel, ticketTimeLabel, visibleSender } from "../lib/format";

export type TicketFace = {
  title: string;
  date: string;
  time: string;
  note: string;
};

export type TicketAudioControl = {
  playing: boolean;
  progress: number;
  isLoading?: boolean;
  toggle: () => void;
  prime?: () => void;
};

type TicketProps = {
  data: TicketFace;
  color?: TicketColor;
  form?: TicketForm;
  senderName?: string;
  showPlaceholders?: boolean;
  decorative?: boolean;
  hasAudio?: boolean;
  audio?: TicketAudioControl | null;
  tearable?: boolean;
  tornOff?: boolean;
  onStubTap?: () => void;
};

const TEAR_SPRING = {
  x: { type: "spring" as const, stiffness: 220, damping: 22, mass: 0.8 },
  y: { type: "spring" as const, stiffness: 180, damping: 20, mass: 0.8 },
  rotate: { type: "spring" as const, stiffness: 160, damping: 18, mass: 0.8 },
};

const SHORT_TEAR = { duration: 0.18, ease: "easeOut" as const };

export function Ticket({
  data,
  color = "green",
  form = 1,
  senderName,
  showPlaceholders = false,
  decorative = false,
  hasAudio = false,
  audio = null,
  tearable = false,
  tornOff = false,
  onStubTap,
}: TicketProps) {
  const reduce = useReducedMotion();
  const dateLabel = ticketDateLabel(data.date);
  const timeLabel = ticketTimeLabel(data.time);
  const note = data.note.trim();
  const showNote = showPlaceholders || note.length > 0;
  const showStub = showPlaceholders || hasAudio;
  const tearLayout = tearable && hasAudio && !decorative;
  const sender = visibleSender(senderName ?? "");
  const canTear = tearLayout && !tornOff && Boolean(onStubTap);
  const canPlay = !decorative && Boolean(audio);

  return (
    <article
      className="relative h-[212px] w-[354px] drop-shadow-[0_14px_28px_rgba(0,0,0,0.38)]"
      aria-label={data.title ? `Invitation: ${data.title}` : "Ticket preview"}
    >
      {tearLayout ? (
        <>
          <div className="absolute top-0 left-0 h-[212px] w-[291px]">
            <img alt="" className="absolute inset-0 block size-full max-w-none" src={ticketAsset(form, color, "body2")} />
          </div>
          <motion.div
            className={canTear ? "absolute cursor-pointer hover:brightness-105" : "absolute"}
            style={{ left: 291, top: 0, width: 65, height: 212, zIndex: tornOff ? 20 : 1 }}
            initial={false}
            animate={tornOff ? { x: -146.5, y: 200, rotate: 90 } : { x: 0, y: 0, rotate: 0 }}
            transition={reduce ? SHORT_TEAR : tornOff ? TEAR_SPRING : SHORT_TEAR}
            onClick={(event) => {
              event.stopPropagation();
              if (!canTear) return;
              const target = event.target;
              if (target instanceof Element && target.closest("button")) return;
              audio?.prime?.();
              onStubTap?.();
            }}
            onKeyDown={(event) => {
              if (!canTear) return;
              if (event.key !== "Enter" && event.key !== " ") return;
              const target = event.target;
              if (target instanceof Element && target.closest("button")) return;
              event.preventDefault();
              audio?.prime?.();
              onStubTap?.();
            }}
            role={canTear ? "button" : undefined}
            tabIndex={canTear ? 0 : undefined}
            aria-label={canTear ? "tap to listen" : undefined}
            data-testid="ticket-stub"
            data-torn={tornOff ? "true" : "false"}
          >
            <img alt="" className="absolute inset-0 block size-full max-w-none" src={ticketAsset(form, color, "stub2")} />
            <StubWave left={18.6} progress={decorative ? 0 : (audio?.progress ?? 0)} />
            <StubPlay
              left={18.3}
              audio={audio}
              canPlay={canPlay}
              decorative={decorative}
              tornOff={tornOff}
              onTear={onStubTap}
            />
          </motion.div>
        </>
      ) : (
        <>
          <div className="absolute top-0 left-0 h-[211.407px] w-[354px]">
            <img alt="" className="absolute inset-0 block size-full max-w-none" src={ticketAsset(form, color, "outer")} />
          </div>
          <div className="absolute top-[8.51px] left-[11.35px] h-[194.381px] w-[266.387px]">
            <img alt="" className="absolute inset-0 block size-full max-w-none" src={ticketAsset(form, color, "main")} />
          </div>
          {showStub ? (
            <div
              className="absolute"
              style={{ left: 301.86, top: 8.51, width: 40.438, height: 194.381, zIndex: 1 }}
              data-testid="ticket-stub"
            >
              <img alt="" className="absolute inset-0 block size-full max-w-none" src={ticketAsset(form, color, "stub")} />
              <StubWave left={5.32} progress={decorative ? 0 : (audio?.progress ?? 0)} />
              <StubPlay left={7.45} audio={audio} canPlay={canPlay} decorative={decorative} />
            </div>
          ) : null}
        </>
      )}

      {showNote ? (
        <div className="absolute top-[159.97px] left-[98.96px] flex h-[31.569px] w-[166.713px] flex-col gap-[1.419px] leading-normal">
          <p className="w-full font-inter text-[8px] font-semibold text-[#7d7d7d] uppercase">note</p>
          <p className="w-full -rotate-1 font-hand text-[14px] font-normal tracking-[-0.2838px] text-[#3a4a8c]">{note}</p>
        </div>
      ) : null}

      <div className="absolute top-[111.38px] left-[98.96px] flex w-[166.713px] items-center gap-[28.377px] leading-normal uppercase">
        <div className="flex flex-col gap-[1.419px]">
          <p className="font-inter text-[8px] font-semibold whitespace-nowrap text-[#7d7d7d]">date</p>
          <p className="font-serif text-[12px] tracking-[-0.227px] whitespace-nowrap text-[#0d0d0f]" style={{ fontFeatureSettings: '"case" 1' }}>
            {dateLabel || "\u00a0"}
          </p>
        </div>
        <div className="flex flex-col gap-[1.419px]">
          <p className="font-inter text-[8px] font-semibold whitespace-nowrap text-[#7d7d7d]">time</p>
          <p className="font-serif text-[12px] tracking-[-0.227px] whitespace-nowrap text-[#0d0d0f]" style={{ fontFeatureSettings: '"case" 1' }}>
            {timeLabel || "\u00a0"}
          </p>
        </div>
      </div>

      <div className="absolute top-[22.6px] left-[98.96px] flex h-[62.429px] w-[166.713px] flex-col gap-[8.513px]">
        <p className="w-full font-inter text-[8px] font-semibold text-[#7d7d7d] uppercase">You&apos;re invited to</p>
        <p className="mt-[-4px] w-full font-serif text-[19.154px] leading-[22.701px] tracking-[-0.3831px] text-[#0d0d0f]">
          {data.title}
        </p>
      </div>

      {sender ? (
        <p className="absolute top-[89px] left-[99px] w-[167.181px] -rotate-1 font-hand text-[14.228px] leading-normal font-normal tracking-[-0.2846px] text-[#3a4a8c]">
          by {sender}
        </p>
      ) : null}

      <div className="absolute top-[calc(50%+74.55px)] left-[calc(50%-130.49px)] flex h-[150px] w-[32px] -translate-x-1/2 -translate-y-full items-center justify-center">
        <div className="-rotate-90">
          <p className="font-serif text-[22.701px] leading-normal tracking-[-0.454px] whitespace-nowrap text-[#0d0d0f] uppercase">
            admit two
          </p>
        </div>
      </div>

      <div className="absolute top-[145.43px] left-[98.96px] h-px w-[166.713px] bg-[#0d0d0f]/25" />
      <div className="absolute top-[8.51px] left-[77.33px] h-[194.381px] w-px bg-[#0d0d0f]/25" />
    </article>
  );
}

function StubWave({ left, progress }: { left: number; progress: number }) {
  return (
    <div
      className="absolute flex h-[132.307px] w-[27.795px] items-center justify-center"
      style={{ left, top: 18.09 }}
      aria-hidden="true"
    >
      <div className="-rotate-90">
        <div className="flex w-[132.307px] items-center gap-[2.712px] overflow-clip rounded-[16.27px] p-[5.423px]">
          {STUB_BARS.map((height, index) => {
            const filled = progress * STUB_BARS.length >= index + 1;
            return (
              <div
                key={index}
                className="w-[3.39px] shrink-0 rounded-[5.423px] transition-colors duration-200"
                style={{ height, backgroundColor: filled ? "#272727" : "rgba(39, 39, 39, 0.3)" }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StubPlay({
  left,
  audio,
  canPlay,
  decorative,
  tornOff = false,
  onTear,
}: {
  left: number;
  audio: TicketAudioControl | null;
  canPlay: boolean;
  decorative: boolean;
  tornOff?: boolean;
  onTear?: () => void;
}) {
  const tornRef = useRef(tornOff);
  tornRef.current = tornOff;
  const className =
    "absolute flex items-center rounded-[35.471px] border-[1.419px] border-solid border-[#272727] p-[8.513px] transition-colors before:absolute before:-inset-3 before:content-['']";
  const icon = audio?.isLoading ? (
    <span className="block size-[8.5px] animate-spin rounded-full border border-[#272727] border-t-transparent" />
  ) : audio?.playing ? (
    <PauseMark />
  ) : (
    <PlayMark />
  );

  if (!canPlay || !audio) {
    return (
      <div className={className} style={{ left, top: 157.49 }} aria-hidden="true">
        <span className="flex size-[8.513px] items-center justify-center">{decorative || !audio ? <PlayMark /> : icon}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${className} cursor-pointer hover:bg-[#272727]/5`}
      style={{ left, top: 157.49 }}
      onClick={(event) => {
        event.stopPropagation();
        if (!tornRef.current && onTear) {
          tornRef.current = true;
          onTear();
          if (!audio.playing) audio.toggle();
          return;
        }
        audio.toggle();
      }}
      aria-label={audio.playing ? "Pause voice note" : "Play voice note"}
      data-testid={audio.playing ? "button-pause-audio" : "button-play-audio"}
    >
      <span className="flex size-[8.513px] items-center justify-center">{icon}</span>
    </button>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[8.5px] -rotate-90 fill-[#272727]" aria-hidden="true">
      <polygon points="7,4 20,12 7,20" />
    </svg>
  );
}

function PauseMark() {
  return (
    <svg viewBox="0 0 10 10" className="size-[8.5px] -rotate-90 fill-[#272727]" aria-hidden="true">
      <rect x="1" y="1" width="3" height="8" rx="1" />
      <rect x="6" y="1" width="3" height="8" rx="1" />
    </svg>
  );
}
