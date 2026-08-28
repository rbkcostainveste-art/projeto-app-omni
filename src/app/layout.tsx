import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flight IA",
  description: "Acompanhamento operacional de voos em tempo real",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true,statusBarStyle: "default",title: "Flight IA" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
