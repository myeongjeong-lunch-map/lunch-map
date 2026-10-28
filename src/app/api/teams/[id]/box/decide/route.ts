import type { NextRequest } from "next/server";
import { decide } from "@/lib/server/drawBox";
import { errorResponse, readVoterId } from "@/lib/server/guard";

// 결정: 조장이 마지막 회차에 뽑힌 가게로 정하면 추첨통이 닫히고 추첨 기록에 남는다
export async function POST(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/box/decide">) {
  try {
    const { id } = await ctx.params;
    await decide(id, await readVoterId(req));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
