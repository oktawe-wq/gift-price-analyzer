import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Аналізатор подарунків — вигода та популярність",
  description: "Професійний інструмент для порівняння цін та індексу популярності подарунків",
  openGraph: {
    title: "Аналізатор подарунків — вигода та популярність",
    description: "Професійний інструмент для порівняння цін та індексу популярності подарунків",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={inter.variable}>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
