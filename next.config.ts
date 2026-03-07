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
      {
        // UploadThing CDN (ufsUrl retornado pelo backend)
        protocol: "https",
        hostname: "utfs.io",
      },
      {
        // UploadThing US/EU CDN alternativo
        protocol: "https",
        hostname: "*.ufs.sh",
      },
    ],
  },
};

export default nextConfig;
