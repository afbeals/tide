import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "archiver", "unzipper"],
  poweredByHeader: false,
};
export default config;
