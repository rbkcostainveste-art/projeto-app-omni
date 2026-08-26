import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Passagem de Pista",
  description: "Acompanhamento operacional de voos em tempo real",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
