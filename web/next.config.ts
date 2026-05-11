import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Resolve .js imports to .ts source files (needed for engine ESM imports)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
