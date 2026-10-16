import { useEffect, useRef, useState } from "react";
import { decidePoint } from "./geo.ts";
import { applyPoint, freshTail, hasPoints, lastPoint } from "./model.ts";
import { loadWalks, saveWalks, trySaveWalks } from "./storage.ts";
import type { Walk, WalkPin, WalkPoint } from "./types.ts";

export type SessionStatus = "idle" | "walking" | "paused" | "denied" | "unsupported";

export type SessionNotice = "uncertain" | "unavailable" | "discarded" | null;

type GeoErrorCode = "denied" | "unavailable";

function geolocationAvailable(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.geolocation !== "undefined" && window.isSecureContext !== false;
}

function newId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && "randomUUID" in cryptoRef) return cryptoRef.randomUUID();
  return `wl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blankWalk(): Walk {
  const now = Date.now();
  return {
    id: newId(),
    startedAt: now,
    endedAt: null,
    pauses: [],
    segments: [{ points: [] }],
    pins: [],
  };
}

function readError(error: GeolocationPositionError): GeoErrorCode {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  return "unavailable";
}

export function useWalkSession() {
  const [walks, setWalks] = useState<Walk[]>(() => loadWalks());
  const [status, setStatus] = useState<SessionStatus>(() => {
    if (!geolocationAvailable()) return "unsupported";
    return loadWalks().some((walk) => walk.endedAt === null) ? "paused" : "idle";
  });
  const [notice, setNotice] = useState<SessionNotice>(null);
  const walksRef = useRef(walks);
  const watchRef = useRef<number | null>(null);
  const activeId = useRef<string | null>(null);

  useEffect(() => {
    saveWalks(walks);
  }, [walks]);

  useEffect(() => {
    return () => {
      if (watchRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      activeId.current = null;
      const open = walksRef.current.find((walk) => walk.endedAt === null);
      if (!open) return;
      if (!hasPoints(open)) {
        saveWalks(walksRef.current.filter((walk) => walk.id !== open.id));
        return;
      }
      if (open.pauses.some((pause) => pause.resumedAt === null)) return;
      saveWalks(
        walksRef.current.map((walk) =>
          walk.id === open.id
            ? { ...walk, pauses: [...walk.pauses, { at: Date.now(), resumedAt: null }], segments: freshTail(walk.segments) }
            : walk,
        ),
      );
    };
  }, []);

  function stopWatch() {
    activeId.current = null;
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }

  function commit(next: Walk[]) {
    walksRef.current = next;
    setWalks(next);
  }

  function openWalk(): Walk | null {
    return walksRef.current.find((walk) => walk.endedAt === null) ?? null;
  }

  function onPosition(walkId: string, position: GeolocationPosition) {
    if (activeId.current !== walkId) return;
    const reported = position.coords.accuracy;
    const point: WalkPoint = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: Number.isFinite(reported) ? reported : 50,
      t: position.timestamp,
    };
    let applied = false;
    let poorAnchor = false;
    const next = walksRef.current.map((walk) => {
      if (walk.id !== walkId || walk.endedAt !== null) return walk;
      const previous = lastPoint(walk);
      const decision = decidePoint(point, previous);
      if (decision.kind === "reject") {
        poorAnchor = decision.reason === "poor" && !previous;
        return walk;
      }
      const tail = walk.segments[walk.segments.length - 1];
      if (decision.kind === "replace" && (!tail || tail.points.length !== 1)) return walk;
      const updated = applyPoint(walk, point, decision.kind);
      applied = updated !== walk;
      return updated;
    });
    if (applied) {
      commit(next);
      setNotice(null);
      return;
    }
    if (poorAnchor) setNotice("uncertain");
  }

  function onError(walkId: string, error: GeolocationPositionError) {
    if (activeId.current !== walkId) return;
    const kind = readError(error);
    if (kind === "denied") {
      stopWatch();
      const open = walksRef.current.find((walk) => walk.id === walkId);
      if (!open || !hasPoints(open)) {
        commit(walksRef.current.filter((walk) => walk.id !== walkId));
        setStatus("denied");
        return;
      }
      commit(
        walksRef.current.map((walk) =>
          walk.id === walkId && !walk.pauses.some((pause) => pause.resumedAt === null)
            ? { ...walk, pauses: [...walk.pauses, { at: Date.now(), resumedAt: null }], segments: freshTail(walk.segments) }
            : walk,
        ),
      );
      setStatus("denied");
      return;
    }
    const open = walksRef.current.find((walk) => walk.id === walkId);
    if (!open || !hasPoints(open)) setNotice("unavailable");
  }

  function beginWatch(walkId: string) {
    if (!geolocationAvailable()) {
      setStatus("unsupported");
      return false;
    }
    stopWatch();
    activeId.current = walkId;
    setStatus("walking");
    setNotice(null);
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => onPosition(walkId, position),
      (error) => onError(walkId, error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 },
    );
    return true;
  }

  function start(): boolean {
    if (!geolocationAvailable()) {
      setStatus("unsupported");
      return false;
    }
    const existing = openWalk();
    if (existing) return resume();
    const walk = blankWalk();
    commit([...walksRef.current.filter((item) => item.endedAt !== null || hasPoints(item)), walk]);
    return beginWatch(walk.id);
  }

  function pause() {
    const open = openWalk();
    stopWatch();
    if (!open || !hasPoints(open)) {
      if (open) commit(walksRef.current.filter((walk) => walk.id !== open.id));
      setStatus(geolocationAvailable() ? "idle" : "unsupported");
      setNotice(null);
      return;
    }
    commit(
      walksRef.current.map((walk) => {
        if (walk.id !== open.id) return walk;
        if (walk.pauses.some((span) => span.resumedAt === null)) return { ...walk, segments: freshTail(walk.segments) };
        return {
          ...walk,
          pauses: [...walk.pauses, { at: Date.now(), resumedAt: null }],
          segments: freshTail(walk.segments),
        };
      }),
    );
    setStatus("paused");
  }

  function resume(): boolean {
    const open = openWalk();
    if (!open) return start();
    commit(
      walksRef.current.map((walk) =>
        walk.id === open.id
          ? {
              ...walk,
              pauses: walk.pauses.map((span) => (span.resumedAt === null ? { ...span, resumedAt: Date.now() } : span)),
              segments: walk.segments.length > 0 ? walk.segments : [{ points: [] }],
            }
          : walk,
      ),
    );
    return beginWatch(open.id);
  }

  function end() {
    const open = openWalk();
    stopWatch();
    if (!open) {
      setStatus(geolocationAvailable() ? "idle" : "unsupported");
      return;
    }
    if (!hasPoints(open)) {
      commit(walksRef.current.filter((walk) => walk.id !== open.id));
      setNotice("discarded");
      setStatus(geolocationAvailable() ? "idle" : "unsupported");
      return;
    }
    const endedAt = Date.now();
    commit(
      walksRef.current.map((walk) =>
        walk.id === open.id
          ? {
              ...walk,
              endedAt,
              pauses: walk.pauses.map((span) => (span.resumedAt === null ? { ...span, resumedAt: endedAt } : span)),
              segments: walk.segments.filter((segment) => segment.points.length > 0),
            }
          : walk,
      ),
    );
    setNotice(null);
    setStatus(geolocationAvailable() ? "idle" : "unsupported");
  }

  function addPin(walkId: string, pin: WalkPin): boolean {
    const next = walksRef.current.map((walk) =>
      walk.id === walkId ? { ...walk, pins: [...(walk.pins ?? []), pin] } : walk,
    );
    if (!next.some((walk) => walk.pins.some((item) => item.id === pin.id))) return false;
    if (!trySaveWalks(next)) return false;
    commit(next);
    return true;
  }

  function setPinCaption(pinId: string, caption: string) {
    const text = caption.slice(0, 80);
    commit(
      walksRef.current.map((walk) => ({
        ...walk,
        pins: (walk.pins ?? []).map((pin) => (pin.id === pinId ? { ...pin, caption: text } : pin)),
      })),
    );
  }

  function removePin(pinId: string) {
    commit(
      walksRef.current.map((walk) => ({
        ...walk,
        pins: (walk.pins ?? []).filter((pin) => pin.id !== pinId),
      })),
    );
  }

  const live = walks.find((walk) => walk.endedAt === null) ?? null;

  return { walks, live, status, notice, start, pause, resume, end, addPin, setPinCaption, removePin };
}
