import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock HappyBoy - Factory & Store",
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
              <span>👕</span>
              <span>Stock HappyBoy</span>
            </div>
            <nav className="flex gap-4">
              <a href="/login" className="btn btn-outline">تسجيل الدخول</a>
            </nav>
          </div>
        </header>
        <main className="container mt-6">{children}</main>
      </body>
    </html>
  );
}
