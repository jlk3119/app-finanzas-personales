import type { Metadata, Viewport } from "next";
import { Geist, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PrivacyProvider } from "@/components/PrivacyProvider";
import { SnackbarProvider } from "@/components/SnackbarProvider";

export const dynamic = "force-dynamic";

const geist = Geist({ subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "MisFinanzas",
  description: "Controla tus gastos y cumple tus objetivos financieros",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MisFinanzas" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#006960" },
    { media: "(prefers-color-scheme: dark)", color: "#101413" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geist.className} ${bricolage.variable} antialiased`}>
        <ThemeProvider>
          <PrivacyProvider>
            <SnackbarProvider>{children}</SnackbarProvider>
          </PrivacyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
