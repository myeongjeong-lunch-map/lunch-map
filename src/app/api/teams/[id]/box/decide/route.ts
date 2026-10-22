import type { NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse, HttpError, readVoterId } from "@/lib/server/guard";
import { boxResults, requireLeader, requireOpenBox } from "@/lib/server/teams";

// 결정: 조장이 마지막 회차에 뽑힌 가게로 정하면 추첨통이 닫히고 추첨 기록에 남는다
export async function POST(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/box/decide">) {
  try {
    const { id } = await ctx.params;
    await requireLeader(id, readVoterId(req));
    const box = await requireOpenBox(id);
    const last = (await boxResults([box.id])).get(box.id)?.at(-1);
    if (!last) throw new HttpError(409, "먼저 추첨해 주세요.");
    const { data, error } = await db()
      .from("draw_boxes")
      .update({ status: "drawn", result_place_id: last.place_id, animation: last.animation, drawn_at: new Date().toISOString() })
      .eq("id", box.id)
      .eq("status", "open")
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new HttpError(409, "이미 결정했거나 취소된 추첨통이에요.");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
