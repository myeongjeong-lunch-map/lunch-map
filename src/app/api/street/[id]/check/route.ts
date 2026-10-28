import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { ensureVoterId, errorResponse, HttpError } from "@/lib/server/guard";
import { getStallRow } from "@/lib/server/street";
import { isCheckFor } from "@/lib/street";

// 노점 확인: 일일 here/gone, 고정 open/closed/quit, null이면 취소. 브라우저 하나가 노점 하나에 하나.
// "있다"(here, open)는 노점의 마지막 확인 시각을 지금으로 당겨 일일 노점은 6시간, 고정 노점은 14일을 다시 채운다.
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/street/[id]/check">) {
  try {
    const { id } = await ctx.params;
    const { value } = (await req.json()) as { value?: unknown };
    const stall = await getStallRow(id);
    if (!stall || stall.removed_at) throw new HttpError(404, "노점을 찾을 수 없어요.");
    if (value !== null && !isCheckFor(stall.fixed, value)) throw new HttpError(400, "잘못된 확인이에요.");
    const res = NextResponse.json({ ok: true });
    const voterId = await ensureVoterId(req, res);
    const now = new Date().toISOString();
    if (value === null) {
      const { error } = await db().from("stall_checks").delete().eq("stall_id", id).eq("voter_id", voterId);
      if (error) throw error;
      return res;
    }
    const { error } = await db().from("stall_checks").upsert({ stall_id: id, voter_id: voterId, value, updated_at: now }, { onConflict: "stall_id,voter_id" });
    if (error) throw error;
    if (value === "here" || value === "open") {
      const { error: sErr } = await db().from("street_stalls").update({ last_seen_at: now }).eq("id", id);
      if (sErr) throw sErr;
    }
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
