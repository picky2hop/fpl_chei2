import type { Metadata } from "next";
import "./globals.css";
import LiffProvider from "./components/liff-gate";

export const metadata: Metadata = {
  title: "FPL Chei Chei | ทายผลพรีเมียร์ลีก",
  description: "เว็บทายผลพรีเมียร์ลีกเล็ก ๆ สำหรับกลุ่มเพื่อนใน LINE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><LiffProvider>{children}</LiffProvider></body>
    </html>
  );
}
