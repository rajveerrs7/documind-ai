// ─────────────────────────────────────────────────────────────────────────────
// Root Layout
//
// Wraps all pages with:
//   - Font setup
//   - Meta tags
//   - Auth initialization provider
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthInitializer } from "@/components/auth/auth-initializer";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DocuMind AI",
    template: "%s | DocuMind AI",
  },
  description:
    "Chat with your PDF documents using AI. Upload, ask questions, and get accurate answers with citations.",
  keywords: ["AI", "PDF", "RAG", "document analysis", "LangChain", "Groq"],
  authors: [{ name: "DocuMind AI" }],
  openGraph: {
    title: "DocuMind AI",
    description: "Chat with your PDF documents using AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* AuthInitializer runs checkAuth on mount */}
        <AuthInitializer />
        {children}
      </body>
    </html>
  );
}
