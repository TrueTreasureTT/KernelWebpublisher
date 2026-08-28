import type { NextConfig } from "next";

const apiUrl = process.env.KERNEL_API_INTERNAL_URL || "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/kernel/:path*",
        destination: `${apiUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
