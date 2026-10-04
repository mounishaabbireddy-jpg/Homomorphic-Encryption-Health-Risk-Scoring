import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack for WASM support (node-seal)
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    config.resolve.fallback = {
      ...config.resolve?.fallback,
      fs: false,
      path: false,
      crypto: false,
      module: false,
    };
    return config;
  },
  // Turbopack config to silence the "no turbopack config" error
  turbopack: {},
  serverExternalPackages: ["node-seal"],
};

export default nextConfig;
