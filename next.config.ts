import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sem experimental.appDir no Next 15 — já é padrão
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
