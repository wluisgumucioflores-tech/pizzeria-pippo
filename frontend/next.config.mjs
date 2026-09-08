import withPWA from "next-pwa";
import createNextIntlPlugin from "next-intl/plugin";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin();

const isDev = process.env.NODE_ENV !== "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Product photos rarely change once uploaded — a long TTL cuts repeat
    // Vercel Image Optimization transformations/cache-writes, and keeps the
    // POS/kitchen tablets serving images from browser cache during a shift.
    minimumCacheTTL: 2678400, // 31 days
    // Wildcard covers any Supabase project (the project ID varies per env)
    // Don't use a fixed hostname — the project ID from .env isn't available at build time
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Local Supabase stack (docker-compose) serves storage over plain HTTP on
      // localhost — dev-only, never allowed in production builds.
      ...(isDev
        ? [
            {
              protocol: "http",
              hostname: "localhost",
              port: "54321",
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
};

const withPWAConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // Imágenes de Supabase Storage — cache-first, 30 días
      urlPattern: /^https:\/\/pftyqugovuximactyrro\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "supabase-images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      // JS/CSS del bundle de Next.js — stale-while-revalidate
      urlPattern: /^\/_next\/static\/.*/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "next-static",
      },
    },
    {
      // Páginas HTML — network-first con fallback offline
      urlPattern: /^\/(pos|display)(\/.*)?$/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "pos-pages",
        networkTimeoutSeconds: 5,
      },
    },
  ],
});

const withAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

export default withAnalyzer(withNextIntl(withPWAConfig(nextConfig)));
