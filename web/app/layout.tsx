import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "AgroSat" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col">
        <header className="border-b border-tinta/15 px-6 py-4">
          <Link href="/" className="font-serif text-xl font-bold text-folha">AgroSat</Link>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-tinta/15 px-6 py-4 text-sm">
          <Link href="/privacidade" className="underline underline-offset-4 hover:text-folha">
            Privacidade
          </Link>
        </footer>
      </body>
    </html>
  );
}
