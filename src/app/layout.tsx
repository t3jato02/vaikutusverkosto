import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "Vaikutusverkosto — Suomen vallan ja rahan julkinen verkosto",
    template: "%s — Vaikutusverkosto",
  },
  description:
    "Julkinen, lähdeperustainen selvitysverkosto suomalaisesta vallasta, rahavirroista, instituutioista ja päätöksenteosta.",
  metadataBase: new URL(process.env.PUBLIC_BASE_URL ?? "https://vaikutusverkosto.example"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}