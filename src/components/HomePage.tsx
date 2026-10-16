import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { clearEditing } from "../lib/draftSession";
import { SAMPLE_SENDER, SAMPLE_TICKETS } from "../lib/ticketStyle";
import { PageFrame } from "./SiteChrome";
import { ScaledBox } from "./ScaledBox";
import { TicketStack } from "./TicketStack";

const STAGE_W = 396.807;
const STAGE_H = 296.398;

export function HomePage() {
  usePageTitle("Admit Two — Date Invitations");
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const sample = SAMPLE_TICKETS[index] ?? SAMPLE_TICKETS[0];

  useEffect(() => {
    if (reduce || !sample) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SAMPLE_TICKETS.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [reduce, sample]);

  return (
    <PageFrame
      right={
        <Link to="/manage" className="font-sans text-sm text-[#A3A3A3]">
          Responses
        </Link>
      }
    >
      <main className="flex flex-1 flex-col items-center gap-10 px-4 pt-6 pb-24">
        <div className="w-full max-w-[370px] pt-2 text-center text-[#F5F2ED]">
          <h1 className="font-serif text-[40px] leading-[1.05]">Make every invite feel special</h1>
          <p className="pt-3.5 font-sans text-base text-[#C8C6C1]">
            Design a ticket, record a personal message, and turn any plan into something special
          </p>
        </div>

        <div
          className="w-full max-w-[397px]"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <ScaledBox width={STAGE_W} height={STAGE_H}>
            <AnimatePresence mode="wait">
              {sample ? (
                <motion.div
                  key={`${sample.form}-${sample.color}-${sample.title}`}
                  className="absolute inset-0"
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -4 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.45, ease: "easeInOut" }}
                >
                  <TicketStack
                    data={{ title: sample.title, date: sample.date, time: sample.time, note: sample.note }}
                    color={sample.color}
                    form={sample.form}
                    senderName={SAMPLE_SENDER}
                    hovered={hovered}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </ScaledBox>
        </div>

        <div className="flex w-full max-w-[354px] flex-col items-center gap-2">
          <Link
            to="/create"
            onClick={() => clearEditing()}
            className="flex w-full items-center justify-center rounded-full bg-[#F5F2ED] px-[18px] py-3 font-inter text-base font-semibold text-[#141414]"
          >
            Create your ticket
          </Link>
          <p className="font-sans text-xs text-[#A3A3A3]">No sign-up needed · ready in a minute</p>
          <Link to="/walk" className="mt-6 font-sans text-xs text-[#6f6e6b]">
            Walking line
          </Link>
        </div>
      </main>
    </PageFrame>
  );
}
