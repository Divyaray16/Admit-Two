import { useCallback, useEffect, useState } from "react";
import { getPublicInvitation } from "../lib/repository";
import type { Invitation } from "../types";

type LoadState = {
  status: "loading" | "ready" | "missing" | "error";
  invitation: Invitation | null;
  message?: string;
};

export function usePublicInvitation(publicId: string) {
  const [state, setState] = useState<LoadState>({ status: "loading", invitation: null });

  const reload = useCallback(() => {
    if (!publicId) {
      setState({ status: "missing", invitation: null });
      return;
    }
    setState({ status: "loading", invitation: null });
    getPublicInvitation(publicId)
      .then((invitation) => {
        setState(invitation ? { status: "ready", invitation } : { status: "missing", invitation: null });
      })
      .catch((error: unknown) => {
        setState({
          status: "error",
          invitation: null,
          message: error instanceof Error ? error.message : "The invitation couldn’t be opened.",
        });
      });
  }, [publicId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
