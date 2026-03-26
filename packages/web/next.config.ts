import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow API requests during development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/:path*",
      },
    ];
  },
};

export default nextConfig;
