import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Telugu, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "./register-sw";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoTelugu = Noto_Sans_Telugu({
  variable: "--font-noto-telugu",
  subsets: ["telugu"],
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
});

export const metadata: Metadata = {
  title: "Mana Ganesh",
  description: "Chanda and expense ledger for festival youth groups",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#D99A1B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoTelugu.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
