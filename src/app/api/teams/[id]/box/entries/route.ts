import type { NextRequest } from "next/server";
import { putEntry, takeEntry } from "@/lib/server/drawBox";
import { errorResponse, HttpError, readVoterId } from "@/lib/server/guard";

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
    await putEntry(id, readVoterId(req), placeId);
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
    await takeEntry(id, readVoterId(req), placeId);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
