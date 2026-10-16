import { useEffect, useRef, useState } from "react";
import { loadPhoto } from "./photos.ts";
import type { WalkPin } from "./types.ts";

type MemoryCardProps = {
  pin: WalkPin;
  onCaption: (pinId: string, caption: string) => void;
  onClose: () => void;
  onRemove: (pinId: string) => void;
};

function tiltOf(id: string): number {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) sum = (sum + id.charCodeAt(index)) % 7;
  return (sum - 3) * 0.7;
}

export function MemoryCard({ pin, onCaption, onClose, onRemove }: MemoryCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const titleId = "memory-card-title";

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void loadPhoto(pin.id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setMissing(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pin.id]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = cardRef.current;
    captionRef.current?.focus();

    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>("button, [href], input, textarea, [tabindex]:not([tabindex='-1'])") ?? [],
      );

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-memory-card]")) return;
      if (target.closest("[data-pin]")) return;
      onCloseRef.current();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      if (previous?.isConnected) previous.focus();
    };
  }, [pin.id]);

  return (
    <>
      <div className="wl-card-dim" aria-hidden="true" />
      <div
        ref={cardRef}
        className="wl-card"
        data-memory-card=""
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ transform: `translate(-50%, -52%) rotate(${tiltOf(pin.id)}deg)` }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="wl-card-bar">
          <h2 id={titleId} className="sr-only">
            Pinned picture
          </h2>
          <button type="button" className="wl-card-close" onClick={onClose}>
            Close
          </button>
        </div>
        {missing ? (
          <p className="wl-card-missing">That picture isn't on this phone.</p>
        ) : (
          <img src={url ?? undefined} alt="" />
        )}
        <input
          ref={captionRef}
          value={pin.caption}
          maxLength={80}
          placeholder="A line about this"
          aria-label="Caption"
          onChange={(event) => onCaption(pin.id, event.target.value)}
        />
        <button type="button" className="wl-card-remove" onClick={() => onRemove(pin.id)}>
          Remove this picture
        </button>
      </div>
    </>
  );
}
