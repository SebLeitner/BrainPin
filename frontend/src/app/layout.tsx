import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrainPin",
  description: "Organize your links by category with quick access tiles."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="bg-slate-950">
      <body className="bg-slate-950 text-slate-100 min-h-screen font-sans">{children}</body>
    </html>
  );
}
