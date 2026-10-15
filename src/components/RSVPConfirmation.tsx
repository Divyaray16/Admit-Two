import type { RsvpStatus } from "../types";

type RSVPConfirmationProps = {
  status: Exclude<RsvpStatus, "pending">;
  senderName: string;
};

export function RSVPConfirmation({ status, senderName }: RSVPConfirmationProps) {
  const accepted = status === "accepted";
  return (
    <div className="mx-auto max-w-md text-center" role="status">
      <h2 className="font-serif text-3xl leading-none text-[#F5F2ED]">
        {accepted ? "Looks like it's a yes." : "We'll let them know."}
      </h2>
      <p className="mt-4 text-[#AAA9A6]">
        {accepted
          ? `${senderName} will be happy to know you're coming.`
          : `${senderName} will see that you can't make it.`}
      </p>
    </div>
  );
}
