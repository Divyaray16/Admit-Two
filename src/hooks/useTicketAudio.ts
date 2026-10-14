import { useCallback, useState } from "react";
import { useAudioPlayer } from "./useAudioPlayer";

export function useTicketAudio(src: string | null, hintDuration = 0) {
  const player = useAudioPlayer(src, hintDuration);
  const [expandedSrc, setExpandedSrc] = useState<string | null>(null);

  const open = useCallback(() => {
    if (!src) return;
    setExpandedSrc(src);
    void player.play();
  }, [player, src]);

  const collapse = useCallback(() => {
    player.pause();
    setExpandedSrc(null);
  }, [player]);

  return {
    expanded: Boolean(src) && expandedSrc === src,
    open,
    collapse,
    toggle: player.toggle,
    seek: player.seek,
    replay: player.replay,
    retry: player.play,
    playing: player.playing,
    currentTime: player.currentTime,
    duration: player.duration,
    error: player.error,
  };
}
