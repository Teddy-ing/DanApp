import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/app/QueryProvider";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "Stock Total-Return Visualizer",
  description: "DRIP total return comparison across tickers",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <QueryProvider>{children}</QueryProvider>
        {process.env.VERCEL_ENV === 'production' ? <Analytics /> : null}
      </body>
    </html>
  );
}
