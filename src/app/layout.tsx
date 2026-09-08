import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "US Healthcare Track | Outsome",
  description: "Outsome US Healthcare Track participant portal",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
