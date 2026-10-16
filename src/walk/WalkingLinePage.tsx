import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import { usePageTitle } from "../hooks/usePageTitle";
import { LineField, type FieldPin } from "./LineField.tsx";
import { MemoryCard } from "./MemoryCard.tsx";
import {
  activeDuration,
  dayOpacity,
  findPin,
  formatClock,
  formatQuietDuration,
  formatSpokenDuration,
  formatWalkDate,
  hasPoints,
  lastPoint,
  weekWalks,
} from "./model.ts";
import { compressImage, deletePhoto, deletePhotosExcept, savePhoto } from "./photos.ts";
import { loadWalks } from "./storage.ts";
import type { Walk, WalkPin } from "./types.ts";
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

function newId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && "randomUUID" in cryptoRef) return cryptoRef.randomUUID();
  return `pin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function statusCopy(status: SessionStatus, notice: SessionNotice, searching: boolean): string | null {
  if (status === "unsupported") {
    return insecureContext()
      ? "Location needs a secure connection. Open this page over HTTPS."
      : "This browser can't share a location, so the line can't be drawn.";
  }
  if (status === "denied") return "Location is blocked. Allow it for this site, then start again.";
  if (searching && notice === "uncertain") return "The location is too uncertain to draw yet.";
  if (searching && notice === "unavailable") return "A location could not be found.";
  if (searching) return "Finding a precise location.";
  if (notice === "discarded") return "No precise location was recorded, so this walk was not kept.";
  return null;
}

function toFieldPins(pins: WalkPin[], openId: string | null): FieldPin[] {
  return pins.map((pin) => ({
    id: pin.id,
    lat: pin.lat,
    lng: pin.lng,
    caption: pin.caption,
    createdAt: pin.createdAt,
    active: pin.id === openId,
  }));
}

export function WalkingLinePage() {
  usePageTitle("Walking Line");
  const reducedMotion = usePrefersReducedMotion();
  const session = useWalkSession();
  const [params, setParams] = useSearchParams();
  const [focus, setFocus] = useState<"session" | "archive">("session");
  const [openPinId, setOpenPinId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selectedId = params.get("w");
  const now = useNow(session.status === "walking");
  const recent = weekWalks(session.walks, now);
  const selected = selectedId ? session.walks.find((walk) => walk.id === selectedId) ?? null : null;
  const showSession =
    !!session.live &&
    focus === "session" &&
    (session.status === "walking" || session.status === "paused" || session.status === "denied");
  const searching = session.status === "walking" && !!session.live && !hasPoints(session.live);
  const openPin = openPinId ? findPin(session.walks, openPinId) : null;

  useEffect(() => {
    const description = document.querySelector('meta[name="description"]');
    const theme = document.querySelector('meta[name="theme-color"]');
    const previousDescription = description?.getAttribute("content");
    const previousTheme = theme?.getAttribute("content");
    description?.setAttribute("content", "The shape of where you have been.");
    theme?.setAttribute("content", "#141414");
    return () => {
      if (previousDescription) description?.setAttribute("content", previousDescription);
      if (previousTheme) theme?.setAttribute("content", previousTheme);
    };
  }, []);

  useEffect(() => {
    const ids = new Set(loadWalks().flatMap((walk) => (walk.pins ?? []).map((pin) => pin.id)));
    void deletePhotosExcept(ids).catch(() => {
      // Photos stay as they are if the store cannot be opened.
    });
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
      setPhotoError(null);
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

  function onPin(id: string) {
    setOpenPinId((current) => (current === id ? null : id));
  }

  async function onPick(event: ChangeEvent<HTMLInputElement>, walkId: string) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const walk = session.walks.find((item) => item.id === walkId);
    const point = walk ? lastPoint(walk) : undefined;
    if (!walk || !point) {
      setPhotoError("Take a few steps first. The picture pins to a point on the line.");
      return;
    }
    setPhotoError(null);
    setSaving(true);
    const id = newId();
    try {
      const blob = await compressImage(file);
      await savePhoto(id, blob);
      const saved = session.addPin(walkId, {
        id,
        lat: point.lat,
        lng: point.lng,
        t: point.t,
        caption: "",
        createdAt: Date.now(),
      });
      if (!saved) {
        await deletePhoto(id);
        setPhotoError("That picture didn't save.");
        return;
      }
      setOpenPinId(id);
    } catch {
      try {
        await deletePhoto(id);
      } catch {
        // The picture was never stored.
      }
      setPhotoError("That picture didn't save.");
    } finally {
      setSaving(false);
    }
  }

  function onRemove(pinId: string) {
    session.removePin(pinId);
    void deletePhoto(pinId);
    setOpenPinId(null);
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
            openPinId={openPinId}
            saving={saving}
            photoError={photoError}
            onPause={session.pause}
            onResume={onResume}
            onEnd={onEnd}
            onWeek={showWeek}
            onPin={onPin}
            onPick={onPick}
          />
        ) : selectedId && !selected ? (
          <MissingWalk onWeek={showWeek} />
        ) : selected ? (
          <SingleWalk
            walk={selected}
            now={now}
            reducedMotion={reducedMotion}
            openPinId={openPinId}
            saving={saving}
            photoError={photoError}
            onWeek={showWeek}
            onPin={onPin}
            onPick={onPick}
          />
        ) : (
          <WeekView
            walks={recent}
            now={now}
            message={message}
            emptyLabel={olderOnly ? "Nothing walked in the last seven days." : "Nothing walked yet."}
            mentionPins={!olderOnly}
            canStart={session.status !== "unsupported"}
            holding={!!session.live}
            reducedMotion={reducedMotion}
            openPinId={openPinId}
            saving={saving}
            photoError={photoError}
            onStart={onStart}
            onResume={onResume}
            onEnd={onEnd}
            onOpen={openWalk}
            onPin={onPin}
            onPick={onPick}
          />
        )}
        <p className="wl-credit">Designed &amp; built by Divya Ray</p>
      </div>
      {openPin ? (
        <MemoryCard key={openPin.pin.id} pin={openPin.pin} onCaption={session.setPinCaption} onClose={() => setOpenPinId(null)} onRemove={onRemove} />
      ) : null}
    </main>
  );
}

function PinControls({
  walkId,
  saving,
  error,
  onPick,
}: {
  walkId: string;
  saving: boolean;
  error: string | null;
  onPick: (event: ChangeEvent<HTMLInputElement>, walkId: string) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  return (
    <div className="wl-pin">
      <p className="wl-kicker">Pin a picture</p>
      <div className="wl-pin-actions">
        <button type="button" onClick={() => cameraRef.current?.click()} disabled={saving}>
          Camera
        </button>
        <button type="button" onClick={() => libraryRef.current?.click()} disabled={saving}>
          Photo library
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => onPick(event, walkId)}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => onPick(event, walkId)}
      />
      {saving ? <p className="wl-pin-note">Saving the picture.</p> : null}
      {error ? (
        <p className="wl-pin-error" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SessionView({
  walk,
  status,
  now,
  message,
  searching,
  reducedMotion,
  openPinId,
  saving,
  photoError,
  onPause,
  onResume,
  onEnd,
  onWeek,
  onPin,
  onPick,
}: {
  walk: Walk;
  status: SessionStatus;
  now: number;
  message: string | null;
  searching: boolean;
  reducedMotion: boolean;
  openPinId: string | null;
  saving: boolean;
  photoError: string | null;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onWeek: () => void;
  onPin: (id: string) => void;
  onPick: (event: ChangeEvent<HTMLInputElement>, walkId: string) => void;
}) {
  const elapsed = activeDuration(walk, now);
  const drawn = hasPoints(walk);
  const aside = status === "denied" ? "Location is blocked." : status === "walking" ? null : "Paused";
  return (
    <div className="wl-live">
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
          pins={toFieldPins(walk.pins ?? [], openPinId)}
          onPin={onPin}
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
      {drawn ? <PinControls walkId={walk.id} saving={saving} error={photoError} onPick={onPick} /> : null}
    </div>
  );
}

function WeekView({
  walks,
  now,
  message,
  emptyLabel,
  mentionPins,
  canStart,
  holding,
  reducedMotion,
  openPinId,
  saving,
  photoError,
  onStart,
  onResume,
  onEnd,
  onOpen,
  onPin,
  onPick,
}: {
  walks: Walk[];
  now: number;
  message: string | null;
  emptyLabel: string;
  mentionPins: boolean;
  canStart: boolean;
  holding: boolean;
  reducedMotion: boolean;
  openPinId: string | null;
  saving: boolean;
  photoError: string | null;
  onStart: () => void;
  onResume: () => void;
  onEnd: () => void;
  onOpen: (walk: Walk) => void;
  onPin: (id: string) => void;
  onPick: (event: ChangeEvent<HTMLInputElement>, walkId: string) => void;
}) {
  const listed = [...walks].reverse();
  const anchor = [...walks].reverse().find((walk) => lastPoint(walk));
  return (
    <>
      <Link to="/" className="wl-home">
        Admit two
      </Link>
      <header>
        <h1 className="wl-title">Walking Line</h1>
        <p className="wl-dek">The shape of where you have been.</p>
      </header>
      {walks.length > 0 ? (
        <LineField
          traces={walks.map((walk) => ({ id: walk.id, segments: walk.segments }))}
          opacities={walks.map((walk) => dayOpacity(walk, now))}
          showHead={false}
          reducedMotion={reducedMotion}
          label="One drawing of the walks from the last seven days."
          pins={toFieldPins(
            walks.flatMap((walk) => walk.pins ?? []),
            openPinId,
          )}
          onPin={onPin}
        />
      ) : (
        <div className="wl-stage wl-stage-empty">
          <p className="wl-empty">{emptyLabel}</p>
          {mentionPins ? <p className="wl-empty-note">Once you have walked, you can pin a picture onto the line.</p> : null}
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
      {anchor ? <PinControls walkId={anchor.id} saving={saving} error={photoError} onPick={onPick} /> : null}
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
  openPinId,
  saving,
  photoError,
  onWeek,
  onPin,
  onPick,
}: {
  walk: Walk;
  now: number;
  reducedMotion: boolean;
  openPinId: string | null;
  saving: boolean;
  photoError: string | null;
  onWeek: () => void;
  onPin: (id: string) => void;
  onPick: (event: ChangeEvent<HTMLInputElement>, walkId: string) => void;
}) {
  const anchor = lastPoint(walk);
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
        pins={toFieldPins(walk.pins ?? [], openPinId)}
        onPin={onPin}
      />
      <p className="wl-readout">
        <span className="wl-clock" aria-label={formatSpokenDuration(activeDuration(walk, walk.endedAt ?? now))}>
          {formatQuietDuration(activeDuration(walk, walk.endedAt ?? now))}
        </span>
      </p>
      {anchor ? <PinControls walkId={walk.id} saving={saving} error={photoError} onPick={onPick} /> : null}
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
