import { useEffect, useRef, type ReactNode } from "react";

type DialogProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function Dialog({ title, children, onClose }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = "dialog-title";

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>("button, [href], input, textarea, [tabindex]:not([tabindex='-1'])") ?? [],
      );

    focusable()[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (nodes.length === 0) return;
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

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-4 py-6 sm:items-center" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md border border-[#343434] bg-[#1D1D1D] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="font-serif text-[2rem] leading-none text-[#F5F2ED]">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
