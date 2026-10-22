import { randomInt } from "node:crypto";
import type { NextRequest } from "next/server";
import { drawWeights, isDrawAnimation, MIN_DRAW_PLACES } from "@/lib/domain";
import { db } from "@/lib/server/supabase";
import { errorResponse, HttpError, readVoterId } from "@/lib/server/guard";
import { boxEntryRows, requireLeader, requireOpenBox } from "@/lib/server/teams";

// 추첨: 조장이 연출을 골라 시작하면 서버가 넣은 한 번 한 번 가운데 하나를 고르게 뽑는다.
// 넣은 횟수만큼 뽑힐 기회가 생기므로 가게별 확률은 가중치 ÷ 가중치 합이다. 다시 돌릴 수 없다 (ADR 0004).
export async function POST(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/box/draw">) {
  try {
    const { id } = await ctx.params;
    const { animation } = (await req.json()) as { animation?: unknown };
    if (!isDrawAnimation(animation)) throw new HttpError(400, "연출을 골라 주세요.");
    await requireLeader(id, readVoterId(req));
    const box = await requireOpenBox(id);
    const entries = await boxEntryRows(box.id);
    if (drawWeights(entries).length < MIN_DRAW_PLACES) throw new HttpError(409, `서로 다른 가게가 ${MIN_DRAW_PLACES}곳 이상 들어 있어야 추첨할 수 있어요.`);

    const winner = entries[randomInt(entries.length)];
    const { data, error } = await db()
      .from("draw_boxes")
      .update({ status: "drawn", animation, result_place_id: winner.place_id, drawn_at: new Date().toISOString() })
      .eq("id", box.id)
      .eq("status", "open")
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new HttpError(409, "이미 추첨했거나 취소된 추첨통이에요.");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
