import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { usePageTitle } from "../hooks/usePageTitle";
import { usePublicInvitation } from "../hooks/usePublicInvitation";
import { markEditing } from "../lib/draftSession";
import { invitationUrl, visibleSender } from "../lib/format";
import { findRegistryEntry } from "../lib/registry";
import { PageFrame } from "./SiteChrome";
import { ScaledBox } from "./ScaledBox";
import { Ticket } from "./Ticket";
import { VoiceNotePlayer } from "./VoiceNotePlayer";

export function InvitationShare() {
  const { publicId = "" } = useParams();
  const navigate = useNavigate();
  const { status, invitation, message, reload } = usePublicInvitation(publicId);
  const [copied, setCopied] = useState(false);
  usePageTitle("Your ticket is ready · Admit Two");
  const url = publicId ? invitationUrl(publicId) : "";
  const entry = publicId ? findRegistryEntry(publicId) : null;
  const player = useAudioPlayer(invitation?.audioUrl ?? null, invitation?.audioDuration ?? 0);
  const progress = player.duration > 0 ? Math.min(1, player.currentTime / player.duration) : 0;
  const sender = visibleSender(invitation?.senderName);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const edit = () => {
    markEditing();
    navigate("/create");
  };

  return (
    <PageFrame onBack={edit}>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-6 px-5 pt-8 pb-24">
        {status === "loading" ? <div className="h-40 w-full animate-pulse rounded-2xl bg-[#242424]" /> : null}
        {status === "missing" ? <p className="text-center text-[#A3A3A3]">This invitation can’t be found.</p> : null}
        {status === "error" ? (
          <div className="text-center">
            <p className="text-red-400">{message}</p>
            <button type="button" className="btn btn-secondary mt-4" onClick={reload}>
              Try again
            </button>
          </div>
        ) : null}

        {invitation ? (
          <>
            <div className="w-full text-center">
              <h1 className="mb-1 font-serif text-2xl text-[#F5F2ED]">Your ticket is ready!</h1>
              <p className="font-sans text-sm text-[#F5F2ED]/70">Copy the link and send it to your date</p>
            </div>

            <div className="w-full overflow-hidden py-4">
              <ScaledBox width={354} height={212}>
                <Ticket
                  data={{
                    title: invitation.title,
                    date: invitation.eventDate,
                    time: invitation.eventTime,
                    note: invitation.note ?? "",
                  }}
                  color={invitation.ticketColor}
                  form={invitation.ticketForm}
                  senderName={sender ?? undefined}
                  hasAudio={Boolean(invitation.audioUrl)}
                  audio={
                    invitation.audioUrl
                      ? { playing: player.playing, progress, toggle: player.toggle }
                      : null
                  }
                />
              </ScaledBox>
            </div>

            {invitation.audioUrl ? (
              <div className="flex w-full flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
                <p className="font-inter text-[11px] font-semibold tracking-wide text-[#7d7d7d] uppercase">Voice note</p>
                <VoiceNotePlayer playing={player.playing} progress={progress} onToggle={player.toggle} />
                {player.error ? <p className="font-sans text-sm text-red-600">{player.error}</p> : null}
              </div>
            ) : null}

            <div className="flex w-full flex-col gap-3">
              <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
                <p className="font-inter text-[11px] font-semibold tracking-wide text-[#7d7d7d] uppercase">Your link</p>
                <p className="font-sans text-sm leading-relaxed break-all text-[#0d0d0f]">{url}</p>
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="w-full rounded-full bg-[#272727] py-3 font-sans text-sm font-semibold text-white"
                  data-testid="button-copy-link"
                >
                  {copied ? "Copied! ✓" : "Copy link"}
                </button>
              </div>
              <Link
                to={`/i/${invitation.publicId}`}
                className="flex w-full items-center justify-center rounded-full border border-[#F5F2ED] py-3 font-sans text-sm font-semibold text-[#F5F2ED]"
              >
                Preview as recipient
              </Link>
              <button type="button" onClick={edit} className="btn-outline">
                Edit ticket
              </button>
              {entry ? (
                <Link to={`/manage/${invitation.publicId}#${entry.manageToken}`} className="btn btn-quiet">
                  View responses
                </Link>
              ) : null}
            </div>
          </>
        ) : null}
      </main>
    </PageFrame>
  );
}
