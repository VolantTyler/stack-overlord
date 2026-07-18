import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "Stack Overlord | Pipeline command center",
  description:
    "A fail-safe command center for GitHub and deployment pipeline health.",
  icons: {
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
    icon: [{ url: "/icon", sizes: "512x512", type: "image/png" }],
    shortcut: [{ url: "/favicon", type: "image/x-icon" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
