import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEventDate, formatEventTime, formatRespondedAt, invitationUrl } from "../lib/format";
import { isLive } from "../lib/mode";
import { findRegistryEntry, readRegistry, rememberInvitation, type RegistryEntry } from "../lib/registry";
import { getManagedInvitation } from "../lib/repository";
import type { Invitation, RsvpStatus } from "../types";
import { usePageTitle } from "../hooks/usePageTitle";
import { AppShell, ModeChip, TicketFooter } from "./SiteChrome";

type Row = {
  entry: RegistryEntry;
  invitation: Invitation | null;
  error?: string;
};

export function InvitationManagement() {
  usePageTitle("Responses · AdmitTwo");
  const { publicId } = useParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const hash = window.location.hash.replace(/^#/, "");
    if (publicId && hash) {
      const existing = findRegistryEntry(publicId);
      rememberInvitation({
        publicId,
        manageToken: hash,
        mode: existing?.mode ?? (isLive ? "live" : "demo"),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      });
      window.history.replaceState(null, "", window.location.pathname);
    }

    const entries = publicId
      ? [findRegistryEntry(publicId)].filter((entry): entry is RegistryEntry => Boolean(entry))
      : readRegistry();

    if (publicId && entries.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const next = await Promise.all(
      entries.map(async (entry) => {
        try {
          const invitation = await getManagedInvitation(entry.publicId, entry.manageToken);
          return { entry, invitation };
        } catch (error) {
          return {
            entry,
            invitation: null,
            error: error instanceof Error ? error.message : "Couldn’t load this invitation.",
          };
        }
      }),
    );
    setRows(next);
    setLoading(false);
  }, [publicId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const unlock = async () => {
    if (!publicId || !keyInput.trim()) return;
    setKeyError(null);
    const invitation = await getManagedInvitation(publicId, keyInput.trim()).catch(() => null);
    if (!invitation) {
      setKeyError("That key doesn’t open this invitation.");
      return;
    }
    rememberInvitation({
      publicId,
      manageToken: keyInput.trim(),
      mode: invitation.mode,
      createdAt: invitation.createdAt,
    });
    setKeyInput("");
    await load();
  };

  return (
    <AppShell
      width="narrow"
      eyebrow={<ModeChip />}
      descriptor="Only invitations created in this browser, or opened with a private sender key."
    >
      <h1 className="font-serif text-5xl leading-none text-[#F5F2ED]">Responses.</h1>
      <p className="mt-4 max-w-md text-[#AAA9A6]">See who answered. A public invitation link never opens this page.</p>
      <div className="mt-6 flex gap-4">
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Refresh
        </button>
        <Link to="/" className="btn btn-quiet">
          Create an invitation
        </Link>
      </div>

      {loading ? <p className="mt-10 text-[#AAA9A6]">Opening your invitations…</p> : null}

      {!loading && publicId && rows.length === 0 ? (
        <form
          className="mt-10 max-w-md"
          onSubmit={(event) => {
            event.preventDefault();
            void unlock();
          }}
        >
          <p className="text-[#AAA9A6]">This sender link needs its private key.</p>
          <label className="lbl mt-4" htmlFor="sender-key">
            Private sender key
          </label>
          <input
            id="sender-key"
            className="field"
            value={keyInput}
            autoComplete="off"
            onChange={(event) => setKeyInput(event.target.value)}
          />
          {keyError ? <p className="field-error">{keyError}</p> : null}
          <button type="submit" className="btn btn-primary mt-4">
            Open
          </button>
        </form>
      ) : null}

      {!loading && !publicId && rows.length === 0 ? (
        <div className="mt-12 max-w-md">
          <p className="font-serif text-3xl text-[#F5F2ED]">Nothing sent yet.</p>
          <p className="mt-3 text-[#AAA9A6]">When you create an invitation, the reply will show up here.</p>
        </div>
      ) : null}

      <ul className="mt-10 grid gap-4">
        {rows.map((row) => (
          <li key={row.entry.publicId} className="border border-[#343434] bg-[#1D1D1D] p-5">
            {row.invitation ? <ManagedCard invitation={row.invitation} /> : <p className="text-[#D7B2AA]">{row.error ?? "This invitation isn’t available with the saved key."}</p>}
          </li>
        ))}
      </ul>
      <TicketFooter />
    </AppShell>
  );
}

function ManagedCard({ invitation }: { invitation: Invitation }) {
  const [copied, setCopied] = useState(false);
  const url = invitationUrl(invitation.publicId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-3xl leading-none text-[#F5F2ED]">{invitation.title}</h2>
        <StatusPill status={invitation.rsvpStatus} />
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] tracking-[0.14em] text-[#6F6E6B] uppercase">For</dt>
          <dd className="mt-1 text-[#F5F2ED]">{invitation.recipientName ?? "Not named"}</dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-[0.14em] text-[#6F6E6B] uppercase">When</dt>
          <dd className="mt-1 text-[#F5F2ED]">
            {formatEventDate(invitation.eventDate)} · {formatEventTime(invitation.eventTime)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-[0.14em] text-[#6F6E6B] uppercase">Replied</dt>
          <dd className="mt-1 text-[#F5F2ED]">{formatRespondedAt(invitation.respondedAt)}</dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-[0.14em] text-[#6F6E6B] uppercase">From</dt>
          <dd className="mt-1 text-[#F5F2ED]">{invitation.senderName}</dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 truncate text-sm text-[#AAA9A6]">{url}</p>
        <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      {invitation.mode === "demo" ? (
        <p className="mt-3 text-xs text-[#8C877A]">Saved in this browser only.</p>
      ) : null}
    </article>
  );
}

function StatusPill({ status }: { status: RsvpStatus }) {
  const styles =
    status === "accepted"
      ? "border-[#3E4A38] text-[#D5E0C8]"
      : status === "declined"
        ? "border-[#4A3E38] text-[#E0D0C8]"
        : "border-[#343434] text-[#AAA9A6]";
  const label = status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : "Pending";
  return <span className={`shrink-0 border px-2.5 py-1 text-[11px] tracking-[0.14em] uppercase ${styles}`}>{label}</span>;
}
