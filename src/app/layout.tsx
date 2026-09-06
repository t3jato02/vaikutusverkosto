import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { baseUrl } from "@/lib/site";

const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext covers ä ö å and other Nordic glyphs
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Vaikutusverkosto — Suomen vallan ja rahan julkinen verkosto",
    template: "%s — Vaikutusverkosto",
  },
  description:
    "Julkinen, lähdeperustainen selvitysverkosto suomalaisesta vallasta, rahavirroista, instituutioista ja päätöksenteosta.",
  metadataBase: new URL(baseUrl()),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi" className={inter.variable}>
      <body className="flex min-h-screen flex-col bg-paper font-sans text-ink antialiased">
        <Header />
        <main className="mx-auto w-full max-w-content flex-1 px-4 py-8 sm:px-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
