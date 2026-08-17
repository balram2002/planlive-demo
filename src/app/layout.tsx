import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "liveWAB demo — live shopping",
  description:
    "Demo/test build: seller starts a live stream and adds products, buyers watch and check out with Cash on Delivery. No accounts, no online payment.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
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
    // suppressHydrationWarning: next-themes stamps the class pre-hydration.
    <html lang="en" suppressHydrationWarning className="antialiased">
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
