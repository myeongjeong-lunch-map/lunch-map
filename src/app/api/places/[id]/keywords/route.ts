import { NextResponse, type NextRequest } from "next/server";
import { isKeyword, MAX_KEYWORDS_PER_PLACE } from "@/lib/domain";
import { db } from "@/lib/server/supabase";
import { ensureVoterId, errorResponse, HttpError } from "@/lib/server/guard";

// 키워드: 이 브라우저가 이 가게에 고른 키워드 목록을 통째로 바꾼다 (최대 5개, 빈 배열이면 모두 취소)
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/places/[id]/keywords">) {
  try {
    const { id } = await ctx.params;
    const { keywords } = (await req.json()) as { keywords?: unknown };
    if (!Array.isArray(keywords) || !keywords.every(isKeyword)) throw new HttpError(400, "잘못된 키워드예요.");
    const unique = [...new Set(keywords)];
    if (unique.length > MAX_KEYWORDS_PER_PLACE) throw new HttpError(400, `키워드는 ${MAX_KEYWORDS_PER_PLACE}개까지 고를 수 있어요.`);

    const res = NextResponse.json({ ok: true });
    const voterId = await ensureVoterId(req, res);
    const { error: delErr } = await db().from("place_keywords").delete().eq("place_id", id).eq("voter_id", voterId);
    if (delErr) throw delErr;
    if (unique.length) {
      const { error } = await db()
        .from("place_keywords")
        .insert(unique.map((keyword) => ({ place_id: id, voter_id: voterId, keyword })));
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
