import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WORLD CUP PICKS",
  description: "A private World Cup prediction pool.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WORLD CUP PICKS",
  },
  applicationName: "WORLD CUP PICKS",
  icons: {
    apple: "/icon.svg",
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#022c22",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      lang="en"
    >
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
