import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { ensureVoterId, errorResponse, HttpError } from "@/lib/server/guard";

// 즐겨찾기: on이 true면 담고 false면 뺀다. 로그인하지 않으면 이 브라우저에만 남는다
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/places/[id]/favorite">) {
  try {
    const { id } = await ctx.params;
    const { on } = (await req.json()) as { on?: unknown };
    if (typeof on !== "boolean") throw new HttpError(400, "잘못된 요청이에요.");
    const res = NextResponse.json({ ok: true });
    const owner = await ensureVoterId(req, res);
    if (on) {
      const { error } = await db().from("favorites").upsert({ owner_id: owner, place_id: id }, { onConflict: "owner_id,place_id", ignoreDuplicates: true });
      if (error) {
        if (error.code === "23503" || error.code === "22P02") throw new HttpError(404, "가게를 찾을 수 없어요.");
        throw error;
      }
    } else {
      const { error } = await db().from("favorites").delete().eq("owner_id", owner).eq("place_id", id);
      if (error) throw error;
    }
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
