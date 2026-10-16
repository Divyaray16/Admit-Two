import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { formatEventDate, formatEventTime, isPastTimeToday } from "../lib/format";

const TIME_SLOTS = Array.from({ length: 24 * 4 }, (_, index) => {
  const hour = Math.floor(index / 4);
  const minute = (index % 4) * 15;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { value, label: formatEventTime(value) };
});

function isoFromDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function todayIso(): string {
  return isoFromDate(new Date());
}

function parseIso(iso: string): Date | null {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function monthCells(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = new Date(year, month, 1 - first.getDay());
  const count = first.getDay() + last.getDate() + (6 - last.getDay());
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

type PopoverBox = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function usePopoverBox(open: boolean, triggerRef: RefObject<HTMLElement | null>, preferredWidth: number): PopoverBox | null {
  const [box, setBox] = useState<PopoverBox | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }

    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const margin = 8;
      const width = Math.max(rect.width, preferredWidth);
      let left = rect.left;
      if (left + width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - margin - width);
      }
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(140, Math.min(320, openUp ? spaceAbove - 4 : spaceBelow - 4));
      const top = openUp ? Math.max(margin, rect.top - maxHeight - 4) : rect.bottom + 4;
      setBox((current) => {
        if (
          current &&
          current.top === top &&
          current.left === left &&
          current.width === width &&
          current.maxHeight === maxHeight
        ) {
          return current;
        }
        return { top, left, width, maxHeight };
      });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, preferredWidth, triggerRef]);

  return box;
}

function useDismiss(open: boolean, nodes: Array<RefObject<HTMLElement | null>>, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (nodes.some((node) => node.current?.contains(target))) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [nodes, onClose, open]);
}

function Popover({ box, panelRef, children, label }: { box: PopoverBox | null; panelRef: RefObject<HTMLDivElement | null>; children: ReactNode; label: string }) {
  if (!box) return null;
  const style: CSSProperties = {
    position: "fixed",
    top: box.top,
    left: box.left,
    width: box.width,
    zIndex: 80,
    maxHeight: box.maxHeight,
  };
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={style}
      className="overflow-y-auto rounded-[12px] border border-[#d5d7da] bg-white text-[#181d27] shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
    >
      {children}
    </div>,
    document.body,
  );
}

export function DateField({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const box = usePopoverBox(open, triggerRef, 280);
  const today = todayIso();
  const selected = parseIso(value);
  const [cursor, setCursor] = useState(() => {
    const base = selected ?? new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const close = () => setOpen(false);
  useDismiss(open, [triggerRef, panelRef], close);

  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor.month, cursor.year]);
  const caption = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="date"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => {
          const base = parseIso(value) ?? new Date();
          setCursor({ year: base.getFullYear(), month: base.getMonth() });
          setOpen((current) => !current);
        }}
        className="paper-field flex cursor-pointer items-center justify-between gap-2 text-left hover:border-[#272727]/40"
      >
        <span className={`truncate ${value ? "text-[#181d27]" : "text-[#717680]"}`}>
          {value ? formatEventDate(value) : "mm.dd.yyyy"}
        </span>
        <Calendar className="size-4 shrink-0 text-[#717680]" aria-hidden="true" />
      </button>
      <Popover box={open ? box : null} panelRef={panelRef} label="Choose a date">
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="grid size-7 place-items-center rounded-md border border-[#e6e6e6] text-[#181d27] hover:bg-[#f9f7f2]"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <p className="font-inter text-sm font-medium text-[#181d27]">{caption}</p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="grid size-7 place-items-center rounded-md border border-[#e6e6e6] text-[#181d27] hover:bg-[#f9f7f2]"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center font-inter text-[12px] font-medium text-[#717680]">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((date) => {
              const iso = isoFromDate(date);
              const inMonth = date.getMonth() === cursor.month;
              const disabled = iso < today;
              const isSelected = iso === value;
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  aria-label={formatEventDate(iso)}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`mx-auto grid size-9 place-items-center rounded-md font-inter text-sm ${
                    isSelected
                      ? "bg-[#272727] font-semibold text-white"
                      : isToday
                        ? "bg-[#f9f7f2] text-[#272727]"
                        : inMonth
                          ? "text-[#181d27] hover:bg-[#f9f7f2]"
                          : "text-[#717680] hover:bg-[#f9f7f2]"
                  } disabled:pointer-events-none disabled:opacity-30`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </Popover>
    </>
  );
}

export function TimeField({
  value,
  date,
  onChange,
  invalid,
}: {
  value: string;
  date: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const box = usePopoverBox(open, triggerRef, 168);
  const close = () => setOpen(false);
  useDismiss(open, [triggerRef, panelRef], close);

  const options = useMemo(
    () => TIME_SLOTS.filter((slot) => !date || !isPastTimeToday(date, slot.value)),
    [date],
  );

  useLayoutEffect(() => {
    if (!open || !box) return;
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !selected) return;
    list.scrollTop = selected.offsetTop - list.clientHeight / 2 + selected.clientHeight / 2;
  }, [box, open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="time"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((current) => !current)}
        className="paper-field flex cursor-pointer items-center justify-between gap-2 text-left hover:border-[#272727]/40"
      >
        <span className={`truncate ${value ? "text-[#181d27]" : "text-[#717680]"}`}>
          {value ? formatEventTime(value) : "--:-- --"}
        </span>
        <Clock className="size-4 shrink-0 text-[#717680]" aria-hidden="true" />
      </button>
      <Popover box={open ? box : null} panelRef={panelRef} label="Choose a time">
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label="time"
          className="max-h-60 overflow-y-auto overscroll-contain py-1"
          style={box ? { maxHeight: box.maxHeight } : undefined}
        >
          {options.length === 0 ? (
            <p className="px-3 py-4 text-center font-inter text-sm text-[#7d7d7d]">No times left today</p>
          ) : (
            options.map((slot) => {
              const selected = slot.value === value;
              return (
                <button
                  key={slot.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(slot.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`w-full px-3 py-2 text-left font-inter text-sm transition-colors ${
                    selected ? "bg-[#272727]/10 font-semibold text-[#272727]" : "text-[#181d27] hover:bg-[#f9f7f2]"
                  }`}
                >
                  {slot.label}
                </button>
              );
            })
          )}
        </div>
      </Popover>
    </>
  );
}
