import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTicketAudio } from "../hooks/useTicketAudio";
import { usePublicInvitation } from "../hooks/usePublicInvitation";
import { formatEventDate, formatEventTime, invitationUrl } from "../lib/format";
import { isLive } from "../lib/mode";
import { findRegistryEntry } from "../lib/registry";
import { usePageTitle } from "../hooks/usePageTitle";
import { AppShell, ModeChip, TicketFooter } from "./SiteChrome";
import { Ticket } from "./Ticket";

export function InvitationShare() {
  const { publicId = "" } = useParams();
  const { status, invitation, message, reload } = usePublicInvitation(publicId);
  const [copied, setCopied] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  usePageTitle("It's ready to send · AdmitTwo");

  const url = publicId ? invitationUrl(publicId) : "";
  const entry = publicId ? findRegistryEntry(publicId) : null;
  const audio = useTicketAudio(invitation?.audioUrl ?? null, invitation?.audioDuration ?? 0);
  const demo = invitation?.mode === "demo" || !isLive;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setShareNote("Couldn’t copy automatically. Select the link and copy it.");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: invitation?.title ?? "An invitation",
          text: invitation ? `${invitation.senderName} sent you an invitation.` : "An invitation for you.",
          url,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy();
  };

  return (
    <AppShell width="narrow" eyebrow={<ModeChip />}>
      <h1 className="text-center font-serif text-5xl leading-none text-[#F5F2ED] md:text-6xl">It&apos;s ready to send.</h1>
      <p className="mx-auto mt-4 max-w-md text-center text-[#AAA9A6]">A little something, made just for them.</p>

      {status === "loading" ? <div className="mx-auto mt-10 h-64 max-w-[740px] animate-pulse rounded-[22px] bg-[#242424]" /> : null}
      {status === "missing" ? (
        <p className="mt-8 text-center text-[#AAA9A6]">This invitation isn’t on this browser.</p>
      ) : null}
      {status === "error" ? (
        <div className="mt-8 text-center">
          <p className="text-[#D7B2AA]">{message}</p>
          <button type="button" className="btn btn-secondary mt-4" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}

      {invitation ? (
        <>
          <div className="mt-10">
            <Ticket
              content={{
                senderName: invitation.senderName,
                title: invitation.title,
                dateLabel: formatEventDate(invitation.eventDate),
                timeLabel: formatEventTime(invitation.eventTime),
                note: invitation.note ?? undefined,
                location: invitation.location ?? undefined,
              }}
              hasAudio={Boolean(invitation.audioUrl)}
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

          <div className="mx-auto mt-8 max-w-lg border border-[#343434] bg-[#1D1D1D] p-4">
            <p className="text-[11px] tracking-[0.16em] text-[#AAA9A6] uppercase">Invitation link</p>
            <p className="mt-2 truncate font-sans text-sm text-[#F5F2ED]">{url}</p>
            {demo ? (
              <p className="mt-3 text-sm text-[#D9CBA8]">
                Demo mode. This link only opens in this browser. It is not publicly shareable. Connect Supabase to send it to someone else.
              </p>
            ) : (
              <p className="mt-3 text-sm text-[#AAA9A6]">
                Anyone with this link can open the invitation. It doesn’t verify who they are.
              </p>
            )}
            {shareNote ? <p className="mt-2 text-sm text-[#D7B2AA]">{shareNote}</p> : null}
          </div>

          <div className="mx-auto mt-5 flex max-w-lg flex-col gap-3 sm:flex-row">
            <button type="button" className="btn btn-primary flex-1" onClick={() => void copy()}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy invitation link"}
            </button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => void share()}>
              <Share2 size={16} />
              Share invitation
            </button>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link to={`/i/${invitation.publicId}`} className="btn btn-quiet">
              Preview invitation
            </Link>
            {entry ? (
              <Link to={`/manage/${invitation.publicId}#${entry.manageToken}`} className="btn btn-quiet">
                View responses
              </Link>
            ) : null}
            <Link to="/" className="btn btn-quiet">
              Create another invitation
            </Link>
          </div>
        </>
      ) : null}
      <TicketFooter />
    </AppShell>
  );
}
