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

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

type PageFrameProps = {
  children: ReactNode;
  backHref?: string;
  onBack?: () => void;
  right?: ReactNode;
};

export function PageFrame({ children, backHref, onBack, right }: PageFrameProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#141414] text-[#F5F2ED]">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-[#F5F2ED] focus:px-3 focus:py-2 focus:text-[#141414]"
      >
        Skip to content
      </a>
      <header className="border-b border-[#2a2a2a] bg-[#141414]">
        <div className="relative flex h-16 items-center justify-center px-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="absolute left-4 flex items-center gap-1 font-sans text-sm text-[#F5F2ED]"
            >
              <BackIcon />
              Back
            </button>
          ) : backHref ? (
            <Link to={backHref} className="absolute left-4 flex items-center gap-1 font-sans text-sm text-[#F5F2ED]">
              <BackIcon />
              Back
            </Link>
          ) : null}
          <Link to="/" className="font-serif text-xl leading-6 font-normal text-[#F5F2ED]">
            admit two
          </Link>
          {right ? <div className="absolute right-4">{right}</div> : null}
        </div>
      </header>
      <div id="content" className="flex flex-1 flex-col">
        {children}
      </div>
      <CreditFooter />
    </div>
  );
}

export function CreditFooter() {
  return (
    <footer className="fixed right-0 bottom-0 left-0 z-50 border-t border-[#2a2a2a] bg-[#141414]">
      <div className="flex h-10 items-center justify-center px-4">
        <p className="text-center font-sans text-xs font-normal text-[#F5F2ED]">Designed &amp; built by Divya Ray</p>
      </div>
    </footer>
  );
}

type AppShellProps = {
  children: ReactNode;
  width?: "wide" | "narrow";
};

export function AppShell({ children, width = "narrow" }: AppShellProps) {
  return (
    <PageFrame right={<ModeChip />}>
      <main className={`mx-auto w-full flex-1 px-5 pt-8 pb-24 ${width === "wide" ? "max-w-3xl" : "max-w-lg"}`}>
        {children}
      </main>
    </PageFrame>
  );
}
