import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:4001";

const nextConfig: NextConfig = {
  transpilePackages: ["@store-health/shared"],
  rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
