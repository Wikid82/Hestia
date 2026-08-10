import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getThemePreference } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hestia",
  description: "A self-hosted household chore chart.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getThemePreference();

  return (
    <html
      lang="en"
      // Omitted for "system" so globals.css falls through to the OS
      // prefers-color-scheme media query instead of forcing a theme.
      data-theme={theme === "system" ? undefined : theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
