import { NextResponse, type NextRequest } from "next/server";
import { db, TIP_COLUMNS } from "@/lib/server/supabase";
import { errorResponse } from "@/lib/server/guard";

// 꿀팁 피드: 모든 가게의 최근 꿀팁
export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));
    const { data, error } = await db().from("tips").select(TIP_COLUMNS).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return NextResponse.json({ tips: data });
  } catch (e) {
    return errorResponse(e);
  }
}
