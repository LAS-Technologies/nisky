import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { SWRegister } from "@/components/pwa/SWRegister";
import { ProactivePrompts } from "@/components/pwa/ProactivePrompts";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-plus-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Nisky", template: "%s - Nisky" },
  description: "Tu espacio para organizar el día, tareas, hábitos y notas.",
  manifest: "/manifest.webmanifest",
  applicationName: "Nisky",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nisky",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/nisky-favicon-v2.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/nisky-otter-approved.png", sizes: "512x512", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "theme-color": "#1e3a5f",
  },
};

export const viewport: Viewport = {
  initialScale: 1,
  interactiveWidget: "resizes-visual",
  viewportFit: "cover",
  width: "device-width",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrains.variable} ${plusJakarta.variable}`}>
      <body className="min-h-screen bg-background text-on-surface antialiased">
        <Providers>{children}</Providers>
        <SWRegister />
        <ProactivePrompts />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
