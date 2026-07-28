import type { Metadata } from "next";
import { Inter, DM_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/themes/ThemeProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "FinPilot — Pilotage Financier",
  description: "SaaS de gestion financière personnelle et professionnelle",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${inter.variable} ${dmMono.variable} ${jakarta.variable} font-sans min-h-screen`}
        style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
