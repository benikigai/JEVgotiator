import type { NextConfig } from "next";
const config: NextConfig = { async rewrites() { return [{ source: "/v1/:path*", destination: "/api/v1/:path*" }]; } };
export default config;
