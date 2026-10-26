// Builds the customer-facing URL that gets encoded into the printed QR.
//
// The route is `/order/<branchId>` — English, like the rest of the codebase
// (the UI text stays Spanish). It was `/pedir` at first, which broke that rule.

/** Origin the QR should point at: an explicit override, else wherever the admin is browsing. */
export function resolvePublicBaseUrl(
  envBaseUrl: string | undefined,
  windowOrigin: string,
): string {
  const configured = envBaseUrl?.trim().replace(/\/+$/, "");
  return configured || windowOrigin;
}

export function buildOrderUrl(baseUrl: string, branchId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/order/${branchId}`;
}

// A QR encoding localhost (or a LAN IP) works on the admin's own machine and
// is useless to a customer on mobile data — and they'd only find out after
// printing it. Worth warning about rather than silently handing over a dead
// QR, which is why this is a separate, tested check.
export function isUnreachableForCustomers(baseUrl: string): boolean {
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return true;
  }

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (host.endsWith(".local")) return true;

  // Private IPv4 ranges (RFC 1918) — a LAN address reaches the tablet in the
  // store but nobody's phone outside the wifi.
  return (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
  );
}
