import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse, HttpError } from "@/lib/server/guard";

const DAY_MS = 24 * 3600 * 1000;

// 캠퍼스에서 이 가게까지의 보행 경로. 없거나 24시간이 지났으면 path: null (TMAP 보관 제한, docs/adr/0001)
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/places/[id]/path">) {
  try {
    const { id } = await ctx.params;
    const { data, error } = await db().from("places").select("walking_path, walking_updated_at").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "가게를 찾을 수 없어요.");
    const fresh = data.walking_updated_at && Date.now() - new Date(data.walking_updated_at).getTime() < DAY_MS;
    return NextResponse.json({ path: fresh ? data.walking_path : null });
  } catch (e) {
    return errorResponse(e);
  }
}
