import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { ensureVoterId, errorResponse, HttpError } from "@/lib/server/guard";

// 평가: value 1(좋아요) / -1(싫어요) / 0(취소). 브라우저 하나당 가게 하나에 하나만 남는다.
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/places/[id]/vote">) {
  try {
    const { id } = await ctx.params;
    const { value } = (await req.json()) as { value?: unknown };
    if (value !== 1 && value !== -1 && value !== 0) throw new HttpError(400, "잘못된 평가예요.");
    const res = NextResponse.json({ ok: true });
    const voterId = await ensureVoterId(req, res);
    if (value === 0) {
      const { error } = await db().from("votes").delete().eq("place_id", id).eq("voter_id", voterId);
      if (error) throw error;
    } else {
      // updated_at: 이번 주 랭킹은 최근 7일 안에 남기거나 바꾼 좋아요만 센다
      const { error } = await db()
        .from("votes")
        .upsert({ place_id: id, voter_id: voterId, value, updated_at: new Date().toISOString() }, { onConflict: "place_id,voter_id" });
      if (error) {
        if (error.code === "23503") throw new HttpError(404, "가게를 찾을 수 없어요.");
        throw error;
      }
    }
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
