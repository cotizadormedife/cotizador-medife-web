import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb", // el Excel de precios ronda 1-2 MB
    },
  },
};

export default nextConfig;
