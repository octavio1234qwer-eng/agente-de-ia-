import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseOrigin = new URL(supabaseUrl).origin;
const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy: bloquea iframes ajenos (clickjacking), plugins y
// orígenes no previstos. Los pagos usan redirección de página completa, por lo
// que no requieren scripts de terceros.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin} https://*.supabase.co`,
  `media-src 'self' blob: ${supabaseOrigin} https://*.supabase.co`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} https://*.supabase.co${isDev ? " ws: http://127.0.0.1:*" : ""}`,
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Modelo de renderizado clásico: las páginas que leen la sesión (cookies)
  // se renderizan dinámicamente y el catálogo público se cachea con revalidate.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      ...(isDev
        ? [{ protocol: "http" as const, hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/public/**" }]
        : []),
    ],
    dangerouslyAllowLocalIP: isDev,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
