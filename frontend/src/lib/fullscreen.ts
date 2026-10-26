// Thin wrapper over the Fullscreen API — the only web-standard way to ask the
// OS to hide its own chrome (status bar + navigation bar on Android) from a
// REGULAR browser tab. Manifest `display` modes (see manifest.json) only
// affect how an INSTALLED PWA launches; they do nothing for a page opened as
// a normal tab, which is why this needs its own trigger.
//
// Must be called from inside a user gesture handler (a click, a tap) — the
// browser silently rejects it otherwise. That's a spec requirement, not
// something this wrapper can work around, so it's exposed as a toggle button
// rather than run automatically on load.

// Older WebView-based browsers (some MIUI/Android builds) only expose the
// webkit-prefixed variant.
interface PrefixedFullscreenDoc extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
}
interface PrefixedFullscreenEl extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

export function isFullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as PrefixedFullscreenEl;
  return typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
}

export function isFullscreenActive(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as PrefixedFullscreenDoc;
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<void> {
  const el = document.documentElement as PrefixedFullscreenEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    // Rejected (not a direct user gesture, or the browser/OS just refuses it)
    // — the toggle button simply stays off, nothing else to do about it.
  }
}

export async function exitFullscreen(): Promise<void> {
  const doc = document as PrefixedFullscreenDoc;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
  } catch {
    // Already out of fullscreen, or unsupported — nothing to do.
  }
}
