import type { NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse, HttpError, readVoterId } from "@/lib/server/guard";
import { requireMember, requireOpenBox } from "@/lib/server/teams";

async function myCount(boxId: string, me: string): Promise<number> {
  const { count, error } = await db().from("draw_entries").select("id", { count: "exact", head: true }).eq("box_id", boxId).eq("member_id", me);
  if (error) throw error;
  return count ?? 0;
}

async function readPlaceId(req: NextRequest): Promise<string> {
  const { placeId } = (await req.json()) as { placeId?: unknown };
  if (typeof placeId !== "string") throw new HttpError(400, "가게를 골라 주세요.");
  return placeId;
}

// 추첨통에 가게 넣기: 같은 가게를 여러 번 넣을 수 있고, 한 사람당 횟수는 추첨통마다 정해져 있다
export async function POST(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/box/entries">) {
  try {
    const { id } = await ctx.params;
    const placeId = await readPlaceId(req);
    const me = readVoterId(req);
    await requireMember(id, me);
    const box = await requireOpenBox(id);
    const over = () => new HttpError(409, `한 사람당 ${box.per_member_limit}번까지 넣을 수 있어요.`);
    if ((await myCount(box.id, me!)) >= box.per_member_limit) throw over();

    const { data, error } = await db().from("draw_entries").insert({ box_id: box.id, member_id: me, place_id: placeId }).select("id").single();
    if (error) {
      if (error.code === "23503" || error.code === "22P02") throw new HttpError(404, "가게를 찾을 수 없어요.");
      throw error;
    }
    // 연달아 눌러 동시에 들어간 요청이 횟수를 넘겼으면 방금 넣은 것을 되돌린다
    if ((await myCount(box.id, me!)) > box.per_member_limit) {
      await db().from("draw_entries").delete().eq("id", data.id);
      throw over();
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

// 내가 넣은 가게 한 번 빼기
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/box/entries">) {
  try {
    const { id } = await ctx.params;
    const placeId = await readPlaceId(req);
    const me = readVoterId(req);
    await requireMember(id, me);
    const box = await requireOpenBox(id);
    const { data, error } = await db().from("draw_entries").select("id").eq("box_id", box.id).eq("member_id", me!).eq("place_id", placeId).limit(1);
    if (error) throw error;
    if (data?.[0]) {
      const { error: delErr } = await db().from("draw_entries").delete().eq("id", data[0].id);
      if (delErr) throw delErr;
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
