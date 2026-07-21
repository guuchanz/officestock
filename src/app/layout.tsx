import type { Metadata } from "next";
import "./globals.css"; 

export const metadata: Metadata = {
  title: "Office Stock | ระบบจัดการสต็อกอุปกรณ์สำนักงาน",
  description: "ระบบติดตามเข้า-ออกอุปกรณ์ไอทีสำนักงาน",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
