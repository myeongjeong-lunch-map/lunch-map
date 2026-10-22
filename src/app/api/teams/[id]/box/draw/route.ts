import { randomInt } from "node:crypto";
import type { NextRequest } from "next/server";
import { drawCandidates, drawWeights, isDrawAnimation, MIN_DRAW_PLACES, type DrawResult } from "@/lib/domain";
import { db } from "@/lib/server/supabase";
import { errorResponse, HttpError, readVoterId } from "@/lib/server/guard";
import { boxEntryRows, boxResults, requireLeader, requireOpenBox } from "@/lib/server/teams";

// 추첨(다시 뽑기 포함): 조장이 연출을 골라 시작하면 서버가 후보 가운데 넣은 한 번 한 번을 고르게 뽑는다.
// 넣은 횟수만큼 뽑힐 기회가 생기므로 가게별 확률은 가중치 ÷ 가중치 합이다.
// 다시 뽑을 때는 앞 회차에 뽑힌 가게를 빼고, 회차마다 결과가 남아 팀원 모두가 본다 (ADR 0004).
export async function POST(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/box/draw">) {
  try {
    const { id } = await ctx.params;
    const { animation } = (await req.json()) as { animation?: unknown };
    if (!isDrawAnimation(animation)) throw new HttpError(400, "연출을 골라 주세요.");
    await requireLeader(id, readVoterId(req));
    const box = await requireOpenBox(id);
    const [entries, results] = await Promise.all([boxEntryRows(box.id), boxResults([box.id])]);
    const done = results.get(box.id) ?? [];
    const candidates = drawCandidates(entries, done);
    if (drawWeights(candidates).length < MIN_DRAW_PLACES) {
      throw new HttpError(409, done.length ? "남은 가게가 1곳뿐이라 다시 뽑을 수 없어요." : `서로 다른 가게가 ${MIN_DRAW_PLACES}곳 이상 들어 있어야 추첨할 수 있어요.`);
    }

    const winner = candidates[randomInt(candidates.length)];
    const { data, error } = await db()
      .from("draw_results")
      .insert({ box_id: box.id, round: done.length + 1, place_id: winner.place_id, animation })
      .select("id, round, place_id, animation, drawn_at")
      .single();
    if (error) {
      // 같은 회차를 동시에 두 번 뽑으려 하면 하나만 남는다
      if (error.code === "23505") throw new HttpError(409, "방금 다른 추첨이 먼저 끝났어요. 다시 확인해 주세요.");
      throw error;
    }
    return Response.json({ result: data as DrawResult });
  } catch (e) {
    return errorResponse(e);
  }
}
