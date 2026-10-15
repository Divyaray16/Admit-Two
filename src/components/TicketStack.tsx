import { motion, useReducedMotion } from "framer-motion";
import type { TicketAudioControl, TicketFace } from "./Ticket";
import { Ticket } from "./Ticket";
import type { TicketColor, TicketForm } from "../lib/ticketStyle";

const EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

type TicketStackProps = {
  data: TicketFace;
  color: TicketColor;
  form: TicketForm;
  senderName?: string;
  hovered?: boolean;
  hasAudio?: boolean;
  audio?: TicketAudioControl | null;
  tearable?: boolean;
  tornOff?: boolean;
  onStubTap?: () => void;
  showHint?: boolean;
};

export function TicketStack({
  data,
  color,
  form,
  senderName,
  hovered = false,
  hasAudio = false,
  audio = null,
  tearable = false,
  tornOff = false,
  onStubTap,
  showHint = false,
}: TicketStackProps) {
  const reduce = useReducedMotion();
  const motionTime = reduce ? "none" : `transform 0.35s ${EASE}`;

  return (
    <div className="relative h-full w-[396.807px]">
      <div className="absolute top-0 left-0 flex h-[296.398px] w-[396.807px] items-center justify-center">
        <div
          className="flex-none"
          style={{
            transform: hovered ? "rotate(-20deg) translate(-8px, -6px)" : "rotate(-15deg)",
            transition: motionTime,
          }}
        >
          <Ticket
            data={{ title: "", date: "", time: "", note: "" }}
            color="white"
            form={form}
            showPlaceholders
            decorative
          />
        </div>
      </div>
      <div
        className="absolute"
        style={{
          left: 21.4,
          top: 20,
          transform: hovered ? "translateY(-10px) scale(1.02)" : "translateY(0) scale(1)",
          transition: motionTime,
        }}
      >
        <Ticket
          data={data}
          color={color}
          form={form}
          senderName={senderName}
          hasAudio={hasAudio}
          audio={audio}
          tearable={tearable}
          tornOff={tornOff}
          onStubTap={onStubTap}
        />
      </div>
      {showHint && !tornOff ? (
        <div className="pointer-events-none absolute top-[272px] left-0 w-[396.807px]" data-testid="hint-tap-to-tear">
          <span className="absolute top-[18px] left-[160px] font-hand text-[16px] leading-normal whitespace-nowrap text-[#F5F2ED]">
            tap to tear off
          </span>
          <motion.svg
            width="83"
            height="44"
            viewBox="0 0 83 44"
            fill="none"
            className="absolute top-0 left-[260px]"
            aria-hidden="true"
          >
            <motion.path
              d="M0.500152 25.184C19.9986 34.9055 52.4897 54.8474 67.6748 28.2981C71.3946 21.7943 70.6064 15.3098 70.2232 8.14382C70.2067 7.83424 68.673 0.727719 68.0826 1.5525C66.5015 3.76106 56.9844 16.6322 63.0749 8.22799C63.7192 7.33889 67.075 0.563232 68.2251 0.501737C71.3586 0.33419 79.6723 11.447 82.1418 13.6659"
              stroke="#F5F2ED"
              strokeWidth="1"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: tornOff ? 0 : 1 }}
              transition={
                reduce || tornOff
                  ? { duration: 0.2 }
                  : { duration: 0.7, ease: "easeOut", delay: 0.5, repeat: Infinity, repeatType: "loop", repeatDelay: 7.5 }
              }
            />
          </motion.svg>
        </div>
      ) : null}
    </div>
  );
}
