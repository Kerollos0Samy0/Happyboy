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
          <header className="app-header" style={{ padding: 0, borderBottom: 'none' }}>
            <div className="container" style={{ justifyContent: 'center', padding: '1rem' }}>
              <div className="logo" style={{ justifyContent: 'center', width: '100%' }}>
                <img src="/ColoredLogo.png" alt="HappyBoy Face Logo" width={280} height={70} style={{ objectFit: 'contain' }} />
              </div>
            </div>
            <div style={{ width: '100%', height: '5px', backgroundColor: '#14b8a6' }}></div>
            <div style={{ width: '100%', height: '2px', backgroundColor: 'white' }}></div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--primary)' }}></div>
          </header>
          <main className="container mt-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
