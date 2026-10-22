import type { NextRequest } from "next/server";
import { isDrawLimit } from "@/lib/domain";
import { db } from "@/lib/server/supabase";
import { errorResponse, HttpError, readVoterId } from "@/lib/server/guard";
import { requireLeader, requireOpenBox } from "@/lib/server/teams";

// 추첨통 만들기: 조장이 한 사람당 넣을 수 있는 횟수(1~3)를 정한다. 팀마다 열린 추첨통은 하나뿐이다.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/box">) {
  try {
    const { id } = await ctx.params;
    const { limit } = (await req.json()) as { limit?: unknown };
    if (!isDrawLimit(limit)) throw new HttpError(400, "넣을 수 있는 횟수는 1~3번이에요.");
    await requireLeader(id, readVoterId(req));
    const { error } = await db().from("draw_boxes").insert({ team_id: id, per_member_limit: limit });
    if (error) {
      if (error.code === "23505") throw new HttpError(409, "이미 열린 추첨통이 있어요.");
      throw error;
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

// 추첨통 취소: 넣은 내용은 사라지고 추첨 기록에도 남지 않는다
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/box">) {
  try {
    const { id } = await ctx.params;
    await requireLeader(id, readVoterId(req));
    const box = await requireOpenBox(id);
    const { error } = await db().from("draw_boxes").update({ status: "cancelled" }).eq("id", box.id).eq("status", "open");
    if (error) throw error;
    const { error: delErr } = await db().from("draw_entries").delete().eq("box_id", box.id);
    if (delErr) throw delErr;
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
