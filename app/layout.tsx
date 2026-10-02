import type { Metadata } from "next";
import { Oswald, Inter } from "next/font/google";
import "./globals.css";

const headingFont = Oswald({
  variable: "--font-heading",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Music Ministry | Serve Together",
  description: "Worship Team Serving Schedule Web App",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        {children}
        <Footer />
        <Toaster 
          toastOptions={{
            classNames: {
              toast: '!bg-brand-cream !border-4 !border-brand-black !shadow-[6px_6px_0_0_#111111] !rounded-none !font-medium !text-brand-black !text-sm !p-4',
              title: '!text-base !font-medium',
              description: '!opacity-80',
              actionButton: '!bg-brand-blue !text-brand-white !border-2 !border-brand-black !rounded-none !shadow-[2px_2px_0_0_#111111]',
              cancelButton: '!bg-brand-white !text-brand-black !border-2 !border-brand-black !rounded-none !shadow-[2px_2px_0_0_#111111]',
              success: '!border-green-700 !text-green-700 [&>svg]:!text-green-700',
              error: '!border-brand-red !text-brand-red [&>svg]:!text-brand-red',
              warning: '!border-brand-red !text-brand-red [&>svg]:!text-brand-red',
              info: '!border-brand-blue !text-brand-blue [&>svg]:!text-brand-blue',
            }
          }}
        />
      </body>
    </html>
  );
}
