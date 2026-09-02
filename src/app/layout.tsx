import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "./AuthProvider";

export const metadata: Metadata = {
  title: "Happy Boy&Girl",
  description: "Management system for Stock HappyBoy factory and stores.",
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AuthProvider>
          <header className="app-header">
            <div className="container">
              <div className="logo">
                <img src="/logo.png" alt="HappyBoy Face Logo" width={40} height={40} style={{ objectFit: 'contain' }} />
                <span>Happy Boy&Girl</span>
              </div>
              <nav>
                <a href="/price-check" className="btn btn-outline" style={{ borderColor: 'var(--primary)', color: 'var(--primary)', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}>
                  استعلام عن السعر 💰
                </a>
              </nav>
            </div>
          </header>
          <main className="container mt-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
