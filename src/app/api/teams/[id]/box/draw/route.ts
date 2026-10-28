import type { NextRequest } from "next/server";
import { isDrawAnimation } from "@/lib/domain";
import { draw } from "@/lib/server/drawBox";
import { errorResponse, HttpError, readVoterId } from "@/lib/server/guard";

// 추첨(다시 뽑기 포함): 조장이 연출을 골라 시작하면 서버가 뽑고 회차마다 결과가 남아 팀원 모두가 본다 (ADR 0004).
export async function POST(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/box/draw">) {
  try {
    const { id } = await ctx.params;
    const { animation } = (await req.json()) as { animation?: unknown };
    if (!isDrawAnimation(animation)) throw new HttpError(400, "연출을 골라 주세요.");
    return Response.json({ result: await draw(id, await readVoterId(req), animation) });
  } catch (e) {
    return errorResponse(e);
  }
}
