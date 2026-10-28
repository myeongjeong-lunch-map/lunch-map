import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, readVoterId } from "@/lib/server/guard";
import { db, TIP_COLUMNS } from "@/lib/server/supabase";

// 내 꿀팁: 나(계정 또는 이 브라우저)가 쓴 꿀팁. 쓴 사람을 남기기 시작한 뒤의 꿀팁만 모인다
export async function GET(req: NextRequest) {
  try {
    const me = await readVoterId(req);
    if (!me) return NextResponse.json({ tips: [] });
    const { data, error } = await db().from("tips").select(TIP_COLUMNS).eq("author_id", me).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ tips: data });
  } catch (e) {
    return errorResponse(e);
  }
}
