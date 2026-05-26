import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "api_server Admin Monitoring Console",
  description: "High-performance Obsidian & Gold real-time system monitoring panel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
