import { useCallback, useEffect, useRef, useState } from "react";

function finiteDuration(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0 || value === Number.POSITIVE_INFINITY) return null;
  return value;
}

export function useAudioPlayer(src: string | null, hintDuration = 0) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const srcRef = useRef<string | null>(src);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(hintDuration);
  const [error, setError] = useState<string | null>(null);

  const destroy = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = "";
    audioRef.current = null;
  }, []);

  const bind = useCallback((audio: HTMLAudioElement) => {
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onDuration = () => {
      const next = finiteDuration(audio.duration);
      if (next) setDuration(next);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      const next = finiteDuration(audio.duration);
      setCurrentTime(next ?? audio.currentTime ?? 0);
    };
    const onError = () => setError("Couldn’t play the recording.");
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const unbindRef = useRef<(() => void) | null>(null);

  const ensure = useCallback(() => {
    const current = srcRef.current;
    if (!current) return null;
    if (audioRef.current) return audioRef.current;
    const audio = new Audio(current);
    audio.preload = "auto";
    unbindRef.current = bind(audio);
    audioRef.current = audio;
    return audio;
  }, [bind]);

  useEffect(() => {
    setDuration((current) => (current > 0 ? current : hintDuration));
  }, [hintDuration]);

  useEffect(() => {
    srcRef.current = src;
    unbindRef.current?.();
    unbindRef.current = null;
    destroy();
    setPlaying(false);
    setCurrentTime(0);
    setDuration(hintDuration);
    setError(null);
    if (!src) return;
    const audio = new Audio(src);
    audio.preload = "auto";
    unbindRef.current = bind(audio);
    audioRef.current = audio;
    return () => {
      unbindRef.current?.();
      unbindRef.current = null;
      destroy();
    };
    // hintDuration is applied above; recreating the element would interrupt playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, bind, destroy]);

  const play = useCallback(() => {
    const audio = ensure();
    if (!audio) return Promise.resolve();
    setError(null);
    return audio.play().catch(() => {
      setError("Couldn’t play the recording.");
    });
  }, [ensure]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    if (audioRef.current?.paused === false) pause();
    else void play();
  }, [pause, play]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const total = finiteDuration(audio.duration) ?? hintDuration;
    const next = Math.min(Math.max(0, time), total || time);
    audio.currentTime = next;
    setCurrentTime(next);
  }, [hintDuration]);

  const replay = useCallback(() => {
    const audio = ensure();
    if (!audio) return Promise.resolve();
    audio.currentTime = 0;
    setCurrentTime(0);
    return play();
  }, [ensure, play]);

  const prime = useCallback(() => {
    const audio = ensure();
    if (!audio || audio.readyState >= 2) return;
    try {
      audio.load();
    } catch {
      /* The next play attempt will surface a failure. */
    }
  }, [ensure]);

  return {
    play,
    pause,
    toggle,
    seek,
    replay,
    prime,
    playing,
    currentTime,
    duration: duration || hintDuration,
    error,
  };
}
