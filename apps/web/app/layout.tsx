import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PICS Nigeria",
  description: "National political platform for voter engagement.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
