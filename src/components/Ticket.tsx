import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { AudioPlayer } from "./AudioPlayer";
import { NotchedFrame } from "./NotchedFrame";
import { TicketStub } from "./TicketStub";

const DESIGN_W = 740;
const COMPACT_H = 430;
const EXPANDED_H = 532;
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export type TicketContent = {
  senderName: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  note?: string;
  location?: string;
};

export type TicketPlayback = {
  expanded: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  onOpen: () => void;
  onToggle: () => void;
  onSeek: (time: number) => void;
  onReplay: () => void;
  onCollapse: () => void;
  onRetry: () => void;
  openLabel?: string;
};

type TicketProps = {
  content: TicketContent;
  hasAudio?: boolean;
  playback?: TicketPlayback;
};

export function Ticket({ content, hasAudio = false, playback }: TicketProps) {
  const reduce = useReducedMotion();
  const expanded = Boolean(hasAudio && playback?.expanded);
  const designH = expanded ? EXPANDED_H : COMPACT_H;
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const controls = useAnimationControls();
  const skip = useRef(!expanded);
  const grainId = useId().replace(/:/g, "");

  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const measure = () => {
      const bounds = Math.min(element.clientWidth, window.innerWidth - 40);
      setScale(Math.min(1, Math.max(0.34, bounds / DESIGN_W)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const duration = reduce ? 0.12 : 0.74;
    if (expanded) {
      void controls.start({
        rotate: 0,
        y: reduce ? 0 : [0, -18, 0],
        filter: "drop-shadow(0 30px 34px rgba(0,0,0,0.5)) drop-shadow(0 3px 6px rgba(0,0,0,0.28))",
        transition: {
          duration,
          ease: EASE,
          times: reduce ? undefined : [0, 0.42, 1],
        },
      });
      return;
    }
    void controls.start({
      rotate: reduce ? 0 : -2.5,
      y: 0,
      filter: "drop-shadow(0 18px 20px rgba(0,0,0,0.4)) drop-shadow(0 2px 3px rgba(0,0,0,0.24))",
      transition: { duration: reduce ? 0.12 : 0.55, ease: EASE },
    });
  }, [controls, expanded, reduce]);

  return (
    <div ref={stageRef} className="w-full">
      <div className="mx-auto" style={{ width: DESIGN_W, zoom: scale }}>
          <div
            className="relative"
            style={{
              width: DESIGN_W,
              height: designH,
              transition: reduce ? "none" : "height 740ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
          <motion.div
            className="relative h-full"
            style={{ width: DESIGN_W, transformOrigin: "50% 46%" }}
            initial={{
              rotate: reduce ? 0 : -2.5,
              y: 0,
              filter: "drop-shadow(0 18px 20px rgba(0,0,0,0.4)) drop-shadow(0 2px 3px rgba(0,0,0,0.24))",
            }}
            animate={controls}
          >
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 overflow-hidden rounded-[22px] bg-[#F4F1EA] shadow-[inset_0_0_0_1px_rgba(90,80,60,0.08)]"
              initial={false}
              animate={{ rotate: expanded ? 2.2 : 6.5, x: expanded ? 0 : 12, y: expanded ? 24 : 16 }}
              transition={{ duration: reduce ? 0.12 : 0.74, ease: EASE }}
            >
              <div className="absolute bottom-8 left-6 font-serif text-[22px] tracking-[0.18em] text-[#E3DCD2]">
                ADMIT
              </div>
            </motion.div>

            <article
              className="absolute inset-0 flex overflow-hidden rounded-[22px] bg-[#DFE1E4] shadow-[inset_0_1px_0_rgba(255,255,255,0.78),inset_0_0_0_1px_rgba(86,96,108,0.2)]"
              aria-label={`Invitation from ${content.senderName}: ${content.title}`}
              style={{
                backgroundImage:
                  "radial-gradient(rgba(44,49,56,0.035) 0.65px, transparent 0.7px)",
                backgroundSize: "3px 3px",
              }}
            >
              <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14] mix-blend-multiply" aria-hidden="true">
                <filter id={grainId}>
                  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
                </filter>
                <rect width="100%" height="100%" filter={`url(#${grainId})`} />
              </svg>

              <div className="relative w-[148px] shrink-0" aria-label="Admit two">
                <NotchedFrame inset={13} radius={18} />
                <AdmitMark />
              </div>

              <div className="my-[18px] w-px shrink-0 bg-[#C5CCD4]" aria-hidden="true" />

              <div className="relative flex min-w-0 flex-1 flex-col px-[28px] pt-[26px] pb-[20px]">
                <p className="font-sans text-[11px] tracking-[0.18em] text-[#8B939E]">YOU&apos;RE INVITED TO</p>
                <h2
                  className="mt-[10px] font-serif leading-[0.96] tracking-[-0.02em] text-[#2A2F36]"
                  style={{ fontSize: titleSize(content.title) }}
                >
                  {content.title}
                </h2>
                <p className="mt-[14px] font-hand text-[30px] leading-none font-medium text-[#6E78A8]">by {content.senderName}</p>
                <div className="mt-[22px] grid grid-cols-2 gap-6">
                  <div>
                    <p className="font-sans text-[10px] tracking-[0.18em] text-[#8B939E]">DATE</p>
                    <p className="mt-[6px] font-serif text-[22px] leading-none text-[#2A2F36]">{content.dateLabel}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] tracking-[0.18em] text-[#8B939E]">TIME</p>
                    <p className="mt-[6px] font-serif text-[22px] leading-none text-[#2A2F36]">{content.timeLabel}</p>
                  </div>
                </div>
                {content.location ? (
                  <p className="mt-3 truncate font-sans text-[13px] text-[#5C6672]">{content.location}</p>
                ) : null}
                <div className="mt-[18px] h-px bg-[#C3CAD3]" />
                {content.note ? (
                  <div className="mt-[16px]">
                    <p className="font-sans text-[10px] tracking-[0.18em] text-[#8B939E]">NOTE</p>
                    <p className="mt-[4px] line-clamp-2 font-hand text-[28px] leading-[1.05] font-medium text-[#6E78A8]">
                      {content.note}
                    </p>
                  </div>
                ) : (
                  <div className="flex-1" />
                )}
                <div className="mt-auto">
                  <AnimatePresence initial={false}>
                    {expanded && playback ? (
                      <motion.div
                        key="player"
                        initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduce ? 0.12 : 0.35, delay: reduce ? 0 : 0.28 }}
                      >
                        <AudioPlayer
                          currentTime={playback.currentTime}
                          duration={playback.duration}
                          error={playback.error}
                          onSeek={playback.onSeek}
                          onReplay={playback.onReplay}
                          onCollapse={playback.onCollapse}
                          onRetry={playback.onRetry}
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex w-[34px] shrink-0 flex-col items-center justify-between py-[22px]" aria-hidden="true">
                {Array.from({ length: 10 }, (_, index) => (
                  <span
                    key={index}
                    className="block h-[14px] w-[14px] rounded-full bg-[#FAF9F6] shadow-[inset_0_1px_1.5px_rgba(40,48,58,0.22)]"
                  />
                ))}
              </div>

              <TicketStub
                hasAudio={hasAudio}
                expanded={expanded}
                playing={Boolean(playback?.playing)}
                senderName={content.senderName}
                openLabel={playback?.openLabel}
                onOpen={playback?.onOpen}
                onToggle={playback?.onToggle}
              />
            </article>
          </motion.div>
          </div>
      </div>
    </div>
  );
}

function AdmitMark() {
  const letters = "ADMIT TWO".split("");
  return (
    <div className="flex h-full items-center justify-center py-[22px]" aria-hidden="true">
      <div className="flex flex-col-reverse items-center">
        {letters.map((letter, index) =>
          letter === " " ? (
            <span key={index} className="h-[16px]" />
          ) : (
            <span key={index} className="font-serif text-[32px] leading-none text-[#2C3138]">
              {letter}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function titleSize(title: string): number {
  if (title.length > 54) return 32;
  if (title.length > 36) return 38;
  return 46;
}
