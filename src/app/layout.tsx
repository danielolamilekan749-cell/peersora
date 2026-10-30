import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import { PlatformProvider } from "@/components/platform";
import { AppChrome } from "@/components/shell";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Daylight",
    template: "%s · Daylight",
  },
  description:
    "A social discovery home for adults. Browse profiles and posts, then connect directly. Not a marketplace for services.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas font-sans text-ink">
        <PlatformProvider>
          <Suspense fallback={<div className="min-h-full bg-canvas" />}>
            <AppChrome>{children}</AppChrome>
          </Suspense>
        </PlatformProvider>
      </body>
    </html>
  );
}
