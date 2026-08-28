import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kernel — Web Publisher", description: "Build and publish websites to Kernel Cloud." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
