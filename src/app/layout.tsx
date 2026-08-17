import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "liveWAB demo — live shopping",
  description:
    "Demo/test build: seller starts a live stream and adds products, buyers watch and check out with Cash on Delivery. No accounts, no online payment.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f6f8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <body>{children}</body>
    </html>
  );
}
