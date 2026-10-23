import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, HttpError } from "@/lib/server/guard";
import { readPlacePath } from "@/lib/server/walkingStore";

// 캠퍼스에서 이 가게까지의 보행 경로. 없거나 24시간이 지났으면 path: null (TMAP 보관 제한, docs/adr/0001)
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/places/[id]/path">) {
  try {
    const { id } = await ctx.params;
    const path = await readPlacePath(id);
    if (path === undefined) throw new HttpError(404, "가게를 찾을 수 없어요.");
    return NextResponse.json({ path });
  } catch (e) {
    return errorResponse(e);
  }
}
