import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { cleanText, ensureVoterId, errorResponse, HttpError, readVoterId } from "@/lib/server/guard";
import { leaveTeam } from "@/lib/server/drawBox";
import { getTeam } from "@/lib/server/teams";

// 팀에 들어오기(이미 팀원이면 닉네임 바꾸기)
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/members">) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const nickname = cleanText(body.nickname, 20);
    if (!nickname) throw new HttpError(400, "닉네임을 적어 주세요.");
    await getTeam(id);
    const res = NextResponse.json({ ok: true });
    const me = await ensureVoterId(req, res);
    const { error } = await db().from("team_members").upsert({ team_id: id, member_id: me, nickname }, { onConflict: "team_id,member_id" });
    if (error) throw error;
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

// 팀 나가기: 열린 추첨통에 넣은 것도 함께 뺀다
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/members">) {
  try {
    const { id } = await ctx.params;
    await leaveTeam(id, await readVoterId(req));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
