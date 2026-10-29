import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { THEME_INIT_SCRIPT } from "@/components/ui/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "명정 점심 지도",
  description: "명정 캠퍼스 사람들이 함께 채우는 점심·카페 지도",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14151a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 저장된 테마는 인라인 스크립트가 첫 화면 전에 data-theme로 적용한다 (그래서 hydration 경고를 끈다)
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full">
        {children}
        {/* 접속 통계(방문자 수·페이지 조회 수). 쿠키를 쓰지 않는다. Vercel 대시보드에서 Web Analytics를 켜야 모인다 */}
        <Analytics />
      </body>
    </html>
  );
}
