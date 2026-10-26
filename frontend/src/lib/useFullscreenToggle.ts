"use client";

import { useState, useEffect, useCallback } from "react";
import { enterFullscreen, exitFullscreen, isFullscreenActive, isFullscreenSupported } from "./fullscreen";

/**
 * Tracks and toggles browser fullscreen. Exiting isn't only done through this
 * toggle — the system back gesture / Esc key exits it too, by design (the
 * browser always allows that, it can't be disabled) — so state is read from
 * the `fullscreenchange` event rather than assumed from the last action here.
 */
export function useFullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(isFullscreenSupported());
    setIsFullscreen(isFullscreenActive());

    const onChange = () => setIsFullscreen(isFullscreenActive());
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggle = useCallback(() => {
    void (isFullscreenActive() ? exitFullscreen() : enterFullscreen());
  }, []);

  return { isFullscreen, supported, toggle };
}
