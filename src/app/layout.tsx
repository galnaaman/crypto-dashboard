import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crypto Dashboard // Live Data",
  description: "Real-time crypto market dashboard — built by AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
        style={{ backgroundColor: "#FAFAFA", color: "#0a0a0a", margin: 0 }}
      >
        {children}
      </body>
    </html>
  );
}
