import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MiNegocio",
  description: "Gestión financiera para tu emprendimiento",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MiNegocio" },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.className} antialiased bg-gray-50`}>
        {children}
      </body>
    </html>
  );
}
