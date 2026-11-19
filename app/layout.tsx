import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/config";
import "./globals.css";

const anton = localFont({
  src: [{ path: "./fonts/anton.woff2", style: "normal", weight: "400" }],
  variable: "--f-anton",
  display: "swap",
});

const inter = localFont({
  src: [{ path: "./fonts/inter.woff2", style: "normal", weight: "100 900" }],
  variable: "--f-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Beibi Doll | Ropa con actitud", template: "%s | Beibi Doll" },
  description:
    "Corsets, tops, jeans, minis y vestidos. Tienda de ropa de San Juan con envíos a todo el país y retiro en el local.",
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Beibi Doll",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Beibi Doll, ropa con actitud" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] },
};

export const viewport: Viewport = {
  themeColor: "#0d0c0e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${anton.variable} ${inter.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
