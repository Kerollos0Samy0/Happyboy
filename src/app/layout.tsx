import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Happy Boy&Girl",
  description: "Management system for Stock HappyBoy factory and stores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <header className="app-header">
          <div className="container">
            <div className="logo">
              <img src="/face-logo.png" alt="HappyBoy Face Logo" width={32} height={32} style={{ objectFit: 'contain' }} />
              <span>Happy Boy&Girl</span>
            </div>
            <nav className="flex gap-4">
              <a href="/" className="btn btn-outline">تسجيل الدخول</a>
            </nav>
          </div>
        </header>
        <main className="container mt-6">{children}</main>
      </body>
    </html>
  );
}
