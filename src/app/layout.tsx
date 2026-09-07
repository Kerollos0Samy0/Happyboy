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
          <header className="app-header" style={{ padding: 0, borderBottom: '2px solid #eee' }}>
            <div className="container" style={{ justifyContent: 'center', padding: '1.5rem' }}>
              <div className="logo" style={{ justifyContent: 'center', width: '100%' }}>
                <img src="/ColoredLogo.png" alt="HappyBoy Face Logo" width={280} height={70} style={{ objectFit: 'contain' }} />
              </div>
            </div>
          </header>
          <main className="container mt-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
