type RSVPControlsProps = {
  senderName: string;
  saving: "accepted" | "declined" | null;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
};

export function RSVPControls({ senderName, saving, error, onAccept, onDecline }: RSVPControlsProps) {
  return (
    <div className="mx-auto w-full max-w-md">
      {error ? (
        <p className="mb-4 text-center text-sm text-[#D7B2AA]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <button type="button" className="btn btn-primary flex-1" disabled={saving != null} onClick={onAccept}>
          {saving === "accepted" ? "Saving…" : "Accept Invitation"}
        </button>
        <button type="button" className="btn btn-secondary flex-1" disabled={saving != null} onClick={onDecline}>
          {saving === "declined" ? "Saving…" : "Decline"}
        </button>
      </div>
      <p className="sr-only">Reply to {senderName}</p>
    </div>
  );
}
