import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { LineField } from "./LineField.tsx";
import { activeDuration, formatClock, formatQuietDuration, formatSpokenDuration, formatWalkDate, hasPoints, weekWalks } from "./model.ts";
import type { Walk } from "./types.ts";
import { useWalkSession, type SessionNotice, type SessionStatus } from "./useWalkSession.ts";
import "./walking-line.css";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return now;
}

function insecureContext(): boolean {
  return window.isSecureContext === false;
}

function statusCopy(status: SessionStatus, notice: SessionNotice, searching: boolean): string | null {
  if (status === "unsupported") {
    return insecureContext()
      ? "Location needs a secure connection. Open this page over HTTPS."
      : "This browser cannot share your location.";
  }
  if (status === "denied") return "Location permission was denied.";
  if (searching && notice === "uncertain") return "The location is too uncertain to draw yet.";
  if (searching && notice === "unavailable") return "A location could not be found.";
  if (searching) return "Finding a precise location.";
  if (notice === "discarded") return "No precise location was recorded, so this walk was not kept.";
  return null;
}

function strokeOpacity(index: number, count: number): number {
  if (count <= 1) return 1;
  return 0.38 + (index / (count - 1)) * 0.62;
}

export function WalkingLinePage() {
  usePageTitle("Walking Line");
  const reducedMotion = usePrefersReducedMotion();
  const session = useWalkSession();
  const [params, setParams] = useSearchParams();
  const [focus, setFocus] = useState<"session" | "archive">("session");
  const selectedId = params.get("w");
  const now = useNow(session.status === "walking");
  const recent = weekWalks(session.walks, now);
  const selected = selectedId ? session.walks.find((walk) => walk.id === selectedId) ?? null : null;
  const showSession =
    !!session.live &&
    focus === "session" &&
    (session.status === "walking" || session.status === "paused" || session.status === "denied");
  const searching = session.status === "walking" && !!session.live && !hasPoints(session.live);

  useEffect(() => {
    const description = document.querySelector('meta[name="description"]');
    const theme = document.querySelector('meta[name="theme-color"]');
    const previousDescription = description?.getAttribute("content");
    const previousTheme = theme?.getAttribute("content");
    description?.setAttribute("content", "The shape of where you have been.");
    theme?.setAttribute("content", "#070708");
    return () => {
      if (previousDescription) description?.setAttribute("content", previousDescription);
      if (previousTheme) theme?.setAttribute("content", previousTheme);
    };
  }, []);

  function showWeek() {
    setFocus("archive");
    setParams({});
  }

  function openWalk(walk: Walk) {
    if (session.live && walk.id === session.live.id && session.live.endedAt === null) {
      setFocus("session");
      setParams({});
      return;
    }
    setFocus("archive");
    setParams({ w: walk.id });
  }

  function onStart() {
    const started = session.start();
    if (started) {
      setFocus("session");
      setParams({});
    }
  }

  function onResume() {
    const started = session.resume();
    if (started) setFocus("session");
  }

  function onEnd() {
    session.end();
    setFocus("archive");
    setParams({});
  }

  const message = statusCopy(session.status, session.notice, searching);
  const olderOnly = session.walks.some(hasPoints) && recent.length === 0;

  return (
    <main className="wl">
      <div className="wl-frame">
        {showSession && session.live ? (
          <SessionView
            walk={session.live}
            status={session.status}
            now={now}
            message={message}
            searching={searching}
            reducedMotion={reducedMotion}
            onPause={session.pause}
            onResume={onResume}
            onEnd={onEnd}
            onWeek={showWeek}
          />
        ) : selectedId && !selected ? (
          <MissingWalk onWeek={showWeek} />
        ) : selected ? (
          <SingleWalk walk={selected} now={now} reducedMotion={reducedMotion} onWeek={showWeek} />
        ) : (
          <WeekView
            walks={recent}
            now={now}
            message={message}
            emptyLabel={olderOnly ? "Nothing walked in the last seven days." : "Nothing walked yet."}
            canStart={session.status !== "unsupported"}
            holding={!!session.live}
            reducedMotion={reducedMotion}
            onStart={onStart}
            onResume={onResume}
            onEnd={onEnd}
            onOpen={openWalk}
          />
        )}
      </div>
    </main>
  );
}

function SessionView({
  walk,
  status,
  now,
  message,
  searching,
  reducedMotion,
  onPause,
  onResume,
  onEnd,
  onWeek,
}: {
  walk: Walk;
  status: SessionStatus;
  now: number;
  message: string | null;
  searching: boolean;
  reducedMotion: boolean;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onWeek: () => void;
}) {
  const elapsed = activeDuration(walk, now);
  const drawn = hasPoints(walk);
  const aside =
    status === "denied" ? "Location permission was denied." : status === "walking" ? null : "Paused";
  return (
    <>
      {status !== "walking" ? (
        <button type="button" className="wl-back" onClick={onWeek}>
          This week
        </button>
      ) : null}
      <header>
        <h1 className="wl-title">Walking Line</h1>
        <p className="wl-dek">The shape of where you have been.</p>
      </header>
      {drawn ? (
        <LineField
          traces={[{ id: walk.id, segments: walk.segments }]}
          opacities={[1]}
          showHead={status === "walking"}
          reducedMotion={reducedMotion}
          label="The line being drawn from this phone's location."
        />
      ) : (
        <div className="wl-stage">
          <p className="wl-empty" aria-live="polite">
            {message ?? "Finding a precise location."}
          </p>
        </div>
      )}
      {drawn ? (
        <p className="wl-readout" aria-live="polite">
          <span className="wl-clock" aria-label={formatSpokenDuration(elapsed)}>
            {formatClock(elapsed)}
          </span>
          <span>{status === "walking" ? message : aside}</span>
        </p>
      ) : null}
      <div className="wl-actions">
        {status === "walking" ? (
          searching ? (
            <button type="button" className="wl-btn" onClick={onPause}>
              Cancel
            </button>
          ) : (
            <>
              <button type="button" className="wl-btn" onClick={onPause}>
                Pause
              </button>
              <button type="button" className="wl-btn wl-btn-ghost" onClick={onEnd}>
                End
              </button>
            </>
          )
        ) : (
          <>
            <button type="button" className="wl-btn" onClick={onResume}>
              Resume
            </button>
            <button type="button" className="wl-btn wl-btn-ghost" onClick={onEnd}>
              End
            </button>
          </>
        )}
      </div>
    </>
  );
}

function WeekView({
  walks,
  now,
  message,
  emptyLabel,
  canStart,
  holding,
  reducedMotion,
  onStart,
  onResume,
  onEnd,
  onOpen,
}: {
  walks: Walk[];
  now: number;
  message: string | null;
  emptyLabel: string;
  canStart: boolean;
  holding: boolean;
  reducedMotion: boolean;
  onStart: () => void;
  onResume: () => void;
  onEnd: () => void;
  onOpen: (walk: Walk) => void;
}) {
  const listed = [...walks].reverse();
  return (
    <>
      <header>
        <h1 className="wl-title">Walking Line</h1>
        <p className="wl-dek">The shape of where you have been.</p>
      </header>
      {walks.length > 0 ? (
        <LineField
          traces={walks.map((walk) => ({ id: walk.id, segments: walk.segments }))}
          opacities={walks.map((_, index) => strokeOpacity(index, walks.length))}
          showHead={false}
          reducedMotion={reducedMotion}
          label="One drawing of the walks from the last seven days."
        />
      ) : (
        <div className="wl-stage">
          <p className="wl-empty">{emptyLabel}</p>
        </div>
      )}
      {message ? (
        <p className="wl-readout" aria-live="polite">
          {message}
        </p>
      ) : (
        <p className="sr-only" aria-live="polite" />
      )}
      {holding || canStart ? (
        <div className="wl-actions">
          {holding ? (
            <>
              {canStart ? (
                <button type="button" className="wl-btn" onClick={onResume}>
                  Resume
                </button>
              ) : null}
              <button type="button" className={canStart ? "wl-btn wl-btn-ghost" : "wl-btn"} onClick={onEnd}>
                End
              </button>
            </>
          ) : (
            <button type="button" className="wl-btn" onClick={onStart}>
              Start
            </button>
          )}
        </div>
      ) : null}
      {listed.length > 0 ? (
        <section className="wl-week" aria-label="Walks from the last seven days">
          <h2 className="wl-kicker">This week</h2>
          <ul className="wl-list">
            {listed.map((walk) => (
              <li key={walk.id}>
                <button type="button" className="wl-row" onClick={() => onOpen(walk)}>
                  <span>{formatWalkDate(walk.startedAt)}</span>
                  <span>{walk.endedAt === null ? "Open" : formatQuietDuration(activeDuration(walk, now))}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function SingleWalk({
  walk,
  now,
  reducedMotion,
  onWeek,
}: {
  walk: Walk;
  now: number;
  reducedMotion: boolean;
  onWeek: () => void;
}) {
  return (
    <>
      <button type="button" className="wl-back" onClick={onWeek}>
        This week
      </button>
      <header>
        <h1 className="wl-title">Walking Line</h1>
        <p className="wl-dek">The shape of where you have been.</p>
        <h2 className="wl-date">{formatWalkDate(walk.startedAt)}</h2>
      </header>
      <LineField
        traces={[{ id: walk.id, segments: walk.segments }]}
        opacities={[1]}
        showHead={false}
        reducedMotion={reducedMotion}
        label="The line of this walk."
      />
      <p className="wl-readout">
        <span className="wl-clock" aria-label={formatSpokenDuration(activeDuration(walk, walk.endedAt ?? now))}>
          {formatQuietDuration(activeDuration(walk, walk.endedAt ?? now))}
        </span>
      </p>
    </>
  );
}

function MissingWalk({ onWeek }: { onWeek: () => void }) {
  return (
    <>
      <button type="button" className="wl-back" onClick={onWeek}>
        This week
      </button>
      <header>
        <h1 className="wl-title">Walking Line</h1>
        <p className="wl-dek">The shape of where you have been.</p>
      </header>
      <p className="wl-missing">That walk is not on this phone.</p>
    </>
  );
}
