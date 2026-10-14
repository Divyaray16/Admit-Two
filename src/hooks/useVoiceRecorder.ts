import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceTake } from "../types";

export const MAX_RECORDING_SECONDS = 90;

export type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "processing"
  | "ready"
  | "denied"
  | "no-device"
  | "unsupported";

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
  return types.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useVoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<VoiceTake | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: 24 }, () => 0.08));
  const [detail, setDetail] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  const takeRef = useRef<VoiceTake | null>(null);

  useEffect(() => {
    takeRef.current = take;
  }, [take]);

  const stopMeter = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close();
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const release = useCallback(() => {
    stopTimer();
    stopMeter();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    stopStream();
  }, [stopMeter, stopStream, stopTimer]);

  useEffect(() => {
    return () => {
      release();
      if (takeRef.current?.url) URL.revokeObjectURL(takeRef.current.url);
    };
  }, [release]);

  useEffect(() => {
    const previous = take?.url;
    return () => {
      if (previous) URL.revokeObjectURL(previous);
    };
  }, [take]);

  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setStatus("processing");
    stopTimer();
    stopMeter();
    recorder.stop();
  }, [stopMeter, stopTimer]);

  const start = useCallback(async () => {
    setDetail(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("unsupported");
      setDetail("This browser can’t record audio. You can still send the invitation without a voice message.");
      return;
    }

    release();
    setElapsed(0);
    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;
      const mime = pickMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mimeRef.current = recorder.mimeType || mime || "audio/webm";
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        const url = URL.createObjectURL(blob);
        const duration = Math.min(MAX_RECORDING_SECONDS, Math.max(0.4, (performance.now() - startedAtRef.current) / 1000));
        stopStream();
        setTake({ blob, url, duration, mime: blob.type || mimeRef.current });
        setStatus("ready");
        recorderRef.current = null;
      };
      recorderRef.current = recorder;
      startedAtRef.current = performance.now();
      recorder.start(200);
      setStatus("recording");

      timerRef.current = window.setInterval(() => {
        const next = (performance.now() - startedAtRef.current) / 1000;
        setElapsed(next);
        if (next >= MAX_RECORDING_SECONDS) finishRecording();
      }, 200);

      const context = new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) {
          const centered = (value - 128) / 128;
          sum += centered * centered;
        }
        const level = Math.min(1, Math.sqrt(sum / data.length) * 3.2);
        setLevels((current) => [...current.slice(1), Math.max(0.08, level)]);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (error) {
      stopStream();
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") {
        setStatus("no-device");
        setDetail(
          name === "NotReadableError"
            ? "The microphone is unavailable. It may be in use by another app."
            : "No microphone was found on this device.",
        );
        return;
      }
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStatus("denied");
        setDetail("Microphone access is blocked. Allow it in the browser, then try again.");
        return;
      }
      setStatus("unsupported");
      setDetail("This browser couldn’t start a recording. You can still send the invitation as a note.");
    }
  }, [finishRecording, release, stopStream]);

  const reset = useCallback(() => {
    release();
    setTake(null);
    setElapsed(0);
    setStatus("idle");
    setDetail(null);
    setLevels(Array.from({ length: 24 }, () => 0.08));
  }, [release]);

  const rerecord = useCallback(() => {
    setTake(null);
    void start();
  }, [start]);

  return {
    status,
    elapsed,
    take,
    levels,
    detail,
    start,
    stop: finishRecording,
    reset,
    rerecord,
    maxSeconds: MAX_RECORDING_SECONDS,
  };
}
