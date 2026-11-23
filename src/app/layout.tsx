import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { themeScript } from "@/components/theme";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Kontora — Invoicing & finances for modern businesses", template: "%s · Kontora" },
  description: "Invoices, customers, expenses, recurring billing and financial reports in one calm workspace.",
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f8f9fc" }, { media: "(prefers-color-scheme: dark)", color: "#0a0c12" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
