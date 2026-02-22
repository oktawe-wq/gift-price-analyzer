import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the sandbox network IP to serve the dev server without 403
  allowedDevOrigins: ["21.0.0.188"],

  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "21.0.0.188",
        port: "3000",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
