import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Аналізатор подарунків — обери найвигідніший",
  description: "Сервіс для розрахунку вигоди подарунків. Порівнюй ціни, бали та обирай найкращі пропозиції швидко й зручно.",
  openGraph: {
    title: "Аналізатор подарунків — обери найвигідніший",
    description: "Сервіс для розрахунку вигоди подарунків. Порівнюй ціни, бали та обирай найкращі пропозиції швидко й зручно.",
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
      </body>
    </html>
  );
}
