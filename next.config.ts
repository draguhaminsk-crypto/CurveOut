import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const contentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';

  img-src
    'self'
    data:
    blob:
    https://*.scryfall.io
    https://*.supabase.co;

  connect-src
    'self'
    https://api.scryfall.com
    https://*.supabase.co
    ${isDev ? "ws: http: https:" : ""};

  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';

  ${isDev ? "" : "upgrade-insecure-requests;"}
`;

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // ✅ NOVO: Otimizações de performance
  compress: true, // Habilita compressão gzip
  productionBrowserSourceMaps: false, // Reduce bundle size

  // ✅ NOVO: Otimizações de imagens
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.scryfall.io",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
    formats: ["image/webp", "image/avif"], // Formatos modernos
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy
              .replace(/\s{2,}/g, " ")
              .trim(),
          },

          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },

          {
            key: "X-Frame-Options",
            value: "DENY",
          },

          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },

          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },

          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },

          // ✅ NOVO: Cache headers para performance
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
            source: "/(_next|public)/.*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;