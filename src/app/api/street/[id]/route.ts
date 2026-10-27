import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse, guardWrite, HttpError } from "@/lib/server/guard";
import { getStallRow } from "@/lib/server/street";

// 일일 노점을 고정 노점(매일 나오는 곳)으로 바꾼다. 누구나 바꿀 수 있고 거꾸로는 없다.
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/street/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    if (body.fixed !== true) throw new HttpError(400, "고정 노점으로만 바꿀 수 있어요.");
    const stall = await getStallRow(id);
    if (!stall || stall.removed_at) throw new HttpError(404, "노점을 찾을 수 없어요.");
    if (stall.fixed) return NextResponse.json({ ok: true });
    await guardWrite(req, body);
    const { error } = await db().from("street_stalls").update({ fixed: true }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
