import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Уместно",
  description: "Схема организации ящика за 5 минут",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
