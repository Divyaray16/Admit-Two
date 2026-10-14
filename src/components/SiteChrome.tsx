import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { isLive } from "../lib/mode";

export function ModeChip() {
  if (isLive) {
    return (
      <span className="rounded-full border border-[#343434] px-3 py-1 text-[11px] tracking-[0.14em] text-[#AAA9A6] uppercase">
        Live
      </span>
    );
  }
  return (
    <span className="rounded-full border border-[#4A4638] bg-[#221F18] px-3 py-1 text-[11px] tracking-[0.12em] text-[#D9CBA8] uppercase">
      Demo · this browser
    </span>
  );
}

type AppShellProps = {
  children: ReactNode;
  eyebrow?: ReactNode;
  descriptor?: string;
  width?: "wide" | "narrow";
};

export function AppShell({ children, eyebrow, descriptor, width = "wide" }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-[#141414] text-[#F5F2ED]">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-[#F5F2ED] focus:px-3 focus:py-2 focus:text-[#141414]"
      >
        Skip to content
      </a>
      <div className={`mx-auto min-w-0 overflow-x-clip px-5 py-6 md:px-8 md:py-8 ${width === "wide" ? "max-w-6xl" : "max-w-3xl"}`}>
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link to="/" className="font-serif text-[1.55rem] leading-none tracking-tight text-[#F5F2ED]">
              AdmitTwo
            </Link>
            {descriptor ? <p className="mt-2 text-sm text-[#AAA9A6]">{descriptor}</p> : null}
          </div>
          {eyebrow ? <div className="pt-1">{eyebrow}</div> : null}
        </header>
        <main id="content" className="mt-10 md:mt-14">
          {children}
        </main>
      </div>
    </div>
  );
}

export function TicketFooter() {
  return (
    <footer className="mt-16 pb-6 text-center">
      <p className="font-sans text-[11px] tracking-[0.22em] text-[#6E6D6A]">ADMITTWO TICKETS CORP.</p>
      <p className="mt-2 text-sm text-[#6E6D6A]">Simply beautiful invites for your private circles.</p>
    </footer>
  );
}
