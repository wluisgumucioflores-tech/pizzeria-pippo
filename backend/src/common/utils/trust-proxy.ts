// How many reverse proxies sit in front of this app. Behind one, every request
// arrives from the proxy's own IP and the real client IP lives in
// X-Forwarded-For — so without this, the public QR rate limit (5 orders/min
// per client) collapses into a GLOBAL 5/min for the whole business.
//
// This is a HOP COUNT and not `true` on purpose. `trust proxy: true` tells
// Express to believe the whole header, and since anyone can write
// X-Forwarded-For, a client would just send a made-up one on every request,
// appear as a new IP each time, and the limit would stop existing altogether —
// strictly worse than not configuring it. With a count, proxy-addr walks
// X-Forwarded-For from the RIGHT and takes the first address outside the
// trusted hops, which the client cannot forge.
//
// The count has to match the deployment exactly:
//   0 → no proxy (default; safe, and what local dev is)
//   1 → nginx / Apache / the host's own proxy in front of Node (Hostinger VPS)
//   2 → Cloudflare (or any CDN) in front of that nginx
//
// Lives in its own file so it can be unit tested: main.ts calls bootstrap() on
// import, so nothing declared there is reachable from a spec.

/**
 * Parses TRUST_PROXY_HOPS. Anything that isn't a non-negative integer degrades
 * to 0, which fails CLOSED: too strict is a bad afternoon, spoofable is a hole.
 */
export function resolveTrustProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 0;

  // Number.parseInt('2abc') is 2 and parseInt('1.9') is 1 — both would quietly
  // accept a typo'd value, so the whole string has to be digits.
  if (!/^\d+$/.test(raw.trim())) return 0;

  const hops = Number.parseInt(raw.trim(), 10);
  return Number.isSafeInteger(hops) ? hops : 0;
}
