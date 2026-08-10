import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import NextTopLoader from "nextjs-toploader";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#c0392b",
};

export const metadata: Metadata = {
  title: "GU PIZZA",
  description: "Sistema de gestión para GU PIZZA",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GU PIZZA",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        {process.env.NODE_ENV === "development" && (
          <>
            <Script src="/react-scan.js" strategy="beforeInteractive" />
            <Script src="/react-scan-reporter.js" strategy="afterInteractive" />
          </>
        )}
        <NextTopLoader color="#c0392b" showSpinner={false} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
