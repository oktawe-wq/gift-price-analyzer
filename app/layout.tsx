import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gift Price Analyzer",
  description: "Compare gift value by price, rating, and Value Index",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
