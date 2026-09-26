import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "JEVgotiator | Find your Tesla. Get your deal.", description: "Evidence-first Tesla search and buying assistance in San Francisco." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
