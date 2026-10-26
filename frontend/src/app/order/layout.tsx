import type { Metadata } from "next";

// Layout for the public QR ordering route — the ONLY route in the app a
// customer of the business ever opens.
//
// Its whole job is metadata. The root layout declares
// `manifest: "/manifest.json"`, which covers every route: `(admin)` and `(pos)`
// are route GROUPS and add no layout above the root, so this page inherited the
// admin PWA manifest. On a phone that meant Chrome offering to install an app
// called "Pizzería Admin" whose start_url is /dashboard — a customer tapping
// "install" got a home-screen icon that opens the staff login.
//
// `manifest: null` removes the inherited tag instead of overriding it with
// another file: the customer should not be installing anything from here. They
// can still use the browser's plain "add to home screen", which is just a
// bookmark to this URL — which is the sane outcome anyway.
//
// This has to be a separate layout because page.tsx is a client component and
// client components cannot export metadata.
export const metadata: Metadata = {
  manifest: null,
  title: "Hacer un pedido",
  description: "Mirá el menú y hacé tu pedido desde el celular.",
  // Also dropped: the root layout's appleWebApp block, which on iOS makes
  // "Add to Home Screen" launch standalone under the name "GU PIZZA".
  appleWebApp: null,
  // A public menu has no business being indexed: the URL is per branch, it
  // only works while the module is on, and prices change.
  robots: { index: false, follow: false },
};

export default function PublicOrderLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
