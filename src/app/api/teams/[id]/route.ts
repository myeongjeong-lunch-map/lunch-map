import type { NextRequest } from "next/server";
import { errorResponse, readVoterId } from "@/lib/server/guard";
import { teamDetail } from "@/lib/server/teamViews";

// 팀 화면: 팀원, 열린 추첨통, 추첨 기록. 추첨 탭이 몇 초마다 다시 불러 결과를 함께 본다.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/teams/[id]">) {
  try {
    const { id } = await ctx.params;
    return Response.json({ team: await teamDetail(id, await readVoterId(req)) });
  } catch (e) {
    return errorResponse(e);
  }
}
