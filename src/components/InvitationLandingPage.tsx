import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTicketAudio } from "../hooks/useTicketAudio";
import { usePublicInvitation } from "../hooks/usePublicInvitation";
import { formatEventDate, formatEventTime } from "../lib/format";
import { respondToInvitation } from "../lib/repository";
import type { Invitation } from "../types";
import { Dialog } from "./Dialog";
import { RSVPConfirmation } from "./RSVPConfirmation";
import { RSVPControls } from "./RSVPControls";
import { usePageTitle } from "../hooks/usePageTitle";
import { AppShell, TicketFooter } from "./SiteChrome";
import { Ticket } from "./Ticket";

export function InvitationLandingPage() {
  const { publicId = "" } = useParams();
  const { status, invitation, message, reload } = usePublicInvitation(publicId);
  usePageTitle(invitation ? `${invitation.senderName} invited you · AdmitTwo` : "AdmitTwo");

  return (
    <AppShell
      width="narrow"
      eyebrow={
        <span className="rounded-full border border-[#4A4A4A] px-3 py-1 text-[10px] tracking-[0.18em] text-[#F5F2ED]">
          INVITATION
        </span>
      }
    >
      {status === "loading" ? <TicketSkeleton /> : null}
      {status === "missing" ? (
        <MissingInvite detail="This ticket can’t be found. Check the link, or ask the sender to share it again." />
      ) : null}
      {status === "error" ? (
        <MissingInvite detail={message ?? "The invitation couldn’t be opened."} onRetry={reload} />
      ) : null}
      {status === "ready" && invitation ? <ReadyInvite key={invitation.publicId} invitation={invitation} /> : null}
      <TicketFooter />
      {invitation?.mode === "demo" ? (
        <p className="pb-8 text-center text-xs text-[#6E6D6A]">Preview stored on this browser. This link is not public.</p>
      ) : null}
    </AppShell>
  );
}

function ReadyInvite({ invitation }: { invitation: Invitation }) {
  const audio = useTicketAudio(invitation.audioUrl, invitation.audioDuration ?? 0);
  const [saving, setSaving] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [current, setCurrent] = useState(invitation);

  const accept = async () => {
    setSaving("accepted");
    setError(null);
    try {
      const next = await respondToInvitation(current.publicId, "accepted");
      setCurrent(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save your reply. Try again.");
    } finally {
      setSaving(null);
    }
  };

  const decline = async () => {
    setConfirmDecline(false);
    setSaving("declined");
    setError(null);
    try {
      const next = await respondToInvitation(current.publicId, "declined");
      setCurrent(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save your reply. Try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      {current.recipientName ? (
        <p className="text-center font-sans text-[11px] tracking-[0.2em] text-[#AAA9A6] uppercase">For {current.recipientName}</p>
      ) : null}
      <h1 className="mt-3 text-center font-serif text-5xl leading-[0.95] text-[#F5F2ED] md:text-6xl">Your ticket is ready.</h1>
      <p className="mx-auto mt-4 max-w-md text-center text-[#AAA9A6]">
        {current.senderName} has sent you a special invitation. Open the ticket details and RSVP to lock in your spot.
      </p>
      {current.message ? (
        <p className="mx-auto mt-6 max-w-md text-center text-[15px] leading-relaxed text-[#C8C6C1]">{current.message}</p>
      ) : null}

      <div className="mt-10">
        <Ticket
          content={{
            senderName: current.senderName,
            title: current.title,
            dateLabel: formatEventDate(current.eventDate),
            timeLabel: formatEventTime(current.eventTime),
            note: current.note ?? undefined,
            location: current.location ?? undefined,
          }}
          hasAudio={Boolean(current.audioUrl)}
          playback={{
            expanded: audio.expanded,
            playing: audio.playing,
            currentTime: audio.currentTime,
            duration: audio.duration,
            error: audio.error,
            onOpen: audio.open,
            onToggle: audio.toggle,
            onSeek: audio.seek,
            onReplay: () => void audio.replay(),
            onCollapse: audio.collapse,
            onRetry: () => void audio.retry(),
          }}
        />
      </div>

      <div className="mt-8">
        {current.rsvpStatus === "pending" ? (
          <RSVPControls
            senderName={current.senderName}
            saving={saving}
            error={error}
            onAccept={() => void accept()}
            onDecline={() => setConfirmDecline(true)}
          />
        ) : (
          <RSVPConfirmation status={current.rsvpStatus} senderName={current.senderName} />
        )}
      </div>

      {confirmDecline ? (
        <Dialog title="Can't make it?" onClose={() => setConfirmDecline(false)}>
          <p className="mt-4 text-[#AAA9A6]">Would you like to let {current.senderName} know?</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setConfirmDecline(false)}>
              Go back
            </button>
            <button type="button" className="btn btn-primary flex-1" onClick={() => void decline()}>
              Confirm decline
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function TicketSkeleton() {
  return (
    <div>
      <div className="mx-auto h-12 max-w-sm animate-pulse bg-[#242424]" />
      <div className="mx-auto mt-8 aspect-[740/460] w-full max-w-[740px] animate-pulse rounded-[22px] bg-[#DFE1E4]/80" />
    </div>
  );
}

function MissingInvite({ detail, onRetry }: { detail: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="font-serif text-5xl leading-none">This ticket can’t be found.</h1>
      <p className="mt-4 text-[#AAA9A6]">{detail}</p>
      <div className="mt-6 flex justify-center gap-4">
        {onRetry ? (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        <Link to="/" className="btn btn-secondary">
          Make an invitation
        </Link>
      </div>
    </div>
  );
}
