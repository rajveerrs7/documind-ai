import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Experimental features ─────────────────────────────────
  experimental: {
    // Required for streaming responses in App Router
    serverComponentsExternalPackages: [
      // These packages use Node.js APIs and must run server-side
      "pdf-parse",
      "formidable",
      "@prisma/client",
      "prisma",
    ],
  },

  // ── Webpack configuration ─────────────────────────────────
  webpack: (config, { isServer }) => {
    if (isServer) {
      // pdf-parse requires canvas, which needs native bindings
      // We externalize it to avoid bundling issues
      config.externals = [...(config.externals || []), "canvas"];
    }

    // Handle pdf-parse's usage of fs module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },

  // ── Image domains ─────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },

  // ── API response size limits ──────────────────────────────
  // Increase for file upload routes
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
    responseLimit: "10mb",
  },
};

export default nextConfig;
