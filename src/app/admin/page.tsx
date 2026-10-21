import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";

export const metadata: Metadata = { title: "관리자 · 명정 점심 지도", robots: { index: false } };

export default function AdminPage() {
  return <AdminPanel />;
}
