import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Cotizador Medife",
  description: "Cotizador individual Medife",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={plusJakartaSans.variable}>
      <body style={{ fontFamily: "var(--font-sans), sans-serif" }}>{children}</body>
    </html>
  );
}
