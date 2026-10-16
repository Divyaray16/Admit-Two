import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { usePageTitle } from "../hooks/usePageTitle";
import { usePublicInvitation } from "../hooks/usePublicInvitation";
import { visibleSender } from "../lib/format";
import { clearEditing } from "../lib/draftSession";
import { respondToInvitation } from "../lib/repository";
import type { Invitation } from "../types";
import { Dialog } from "./Dialog";
import { RSVPConfirmation } from "./RSVPConfirmation";
import { RSVPControls } from "./RSVPControls";
import { PageFrame } from "./SiteChrome";
import { ScaledBox } from "./ScaledBox";
import { TicketStack } from "./TicketStack";

const STAGE_W = 396.807;

export function InvitationLandingPage() {
  const { publicId = "" } = useParams();
  const { status, invitation, message, reload } = usePublicInvitation(publicId);
  usePageTitle(invitation ? `${visibleSender(invitation.senderName) ?? "Someone"} invited you · Admit Two` : "Admit Two");

  return (
    <PageFrame>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-8 px-5 pt-8 pb-24">
        {status === "loading" ? <div className="mt-16 h-12 w-48 animate-pulse rounded-full bg-[#242424]" /> : null}
        {status === "missing" ? (
          <MissingInvite detail="This ticket can’t be found. Check the link, or ask the sender to share it again." />
        ) : null}
        {status === "error" ? (
          <MissingInvite detail={message ?? "The invitation couldn’t be opened."} onRetry={reload} />
        ) : null}
        {status === "ready" && invitation ? <ReadyInvite key={invitation.publicId} invitation={invitation} /> : null}
      </main>
    </PageFrame>
  );
}

function ReadyInvite({ invitation }: { invitation: Invitation }) {
  const player = useAudioPlayer(invitation.audioUrl, invitation.audioDuration ?? 0);
  const [torn, setTorn] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [saving, setSaving] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [current, setCurrent] = useState(invitation);
  const hasAudio = Boolean(current.audioUrl);
  const progress = player.duration > 0 ? Math.min(1, player.currentTime / player.duration) : 0;
  const stageHeight = torn ? 400 : hasAudio ? 340 : 296.398;
  const sender = visibleSender(current.senderName);

  const accept = async () => {
    setSaving("accepted");
    setError(null);
    try {
      setCurrent(await respondToInvitation(current.publicId, "accepted"));
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
      setCurrent(await respondToInvitation(current.publicId, "declined"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save your reply. Try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="flex w-full flex-col items-center gap-2 text-center">
        <p className="font-inter text-[11px] font-semibold tracking-widest text-[#A3A3A3] uppercase">You&apos;re invited to</p>
        <h1 className="font-serif text-[32px] leading-[38px] text-[#F5F2ED]">{current.title}</h1>
      </div>

      <div
        className="w-full"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <ScaledBox width={STAGE_W} height={stageHeight}>
          <TicketStack
            data={{
              title: current.title,
              date: current.eventDate,
              time: current.eventTime,
              note: current.note ?? "",
            }}
            color={current.ticketColor}
            form={current.ticketForm}
            senderName={sender ?? undefined}
            hovered={hovered}
            hasAudio={hasAudio}
            tearable
            tornOff={torn}
            showHint={hasAudio}
            onStubTap={() => setTorn(true)}
            audio={
              hasAudio
                ? { playing: player.playing, progress, toggle: player.toggle, prime: player.prime }
                : null
            }
          />
        </ScaledBox>
      </div>

      {hasAudio && torn ? (
        <p className="font-inter text-[11px] font-semibold tracking-wide text-[#A3A3A3] uppercase">A little message for you</p>
      ) : null}
      {player.error ? <p className="text-center font-sans text-sm text-red-400">{player.error}</p> : null}

      <div className="w-full">
        {current.rsvpStatus === "pending" ? (
          <RSVPControls
            senderName={sender ?? "them"}
            saving={saving}
            error={error}
            onAccept={() => void accept()}
            onDecline={() => setConfirmDecline(true)}
          />
        ) : (
          <RSVPConfirmation status={current.rsvpStatus} senderName={sender ?? "They"} />
        )}
      </div>

      <Link
        to="/create"
        onClick={() => clearEditing()}
        className="flex w-full items-center justify-center rounded-full bg-[#F5F2ED] px-[18px] py-3.5 font-sans text-base font-semibold text-[#141414]"
      >
        Create your own ticket
      </Link>

      {confirmDecline ? (
        <Dialog title="Can't make it?" onClose={() => setConfirmDecline(false)}>
          <p className="mt-4 text-[#AAA9A6]">Would you like to let {sender ?? "them"} know?</p>
          <div className="mt-6 flex flex-col gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmDecline(false)}>
              Go back
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void decline()}>
              Confirm decline
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function MissingInvite({ detail, onRetry }: { detail: string; onRetry?: () => void }) {
  return (
    <div className="flex w-full flex-col gap-4 pt-12 text-center">
      <h1 className="font-serif text-[28px] leading-[34px] text-[#F5F2ED]">This invitation link is broken or incomplete</h1>
      <p className="font-inter text-sm leading-[22px] text-[#A3A3A3]">{detail}</p>
      <div className="mt-2 flex flex-col gap-3">
        {onRetry ? (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        <Link to="/create" className="btn btn-secondary" onClick={() => clearEditing()}>
          Create your own ticket
        </Link>
      </div>
    </div>
  );
}
