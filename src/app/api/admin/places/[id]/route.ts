import { NextResponse, type NextRequest } from "next/server";
import { isCategory } from "@/lib/domain";
import { resolveNaverPlaceId } from "@/lib/naverPlaceId";
import { db } from "@/lib/server/supabase";
import { cleanText, errorResponse, HttpError, requireAdmin } from "@/lib/server/guard";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/places/[id]">) {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = cleanText(body.name, 60);
      if (!name) throw new HttpError(400, "이름이 비었어요.");
      update.name = name;
    }
    if (body.category !== undefined) {
      if (!isCategory(body.category)) throw new HttpError(400, "잘못된 카테고리예요.");
      update.category = body.category;
    }
    if (body.naverLink !== undefined) {
      const link = cleanText(body.naverLink, 500);
      if (!link) update.naver_place_id = null;
      else {
        const placeId = await resolveNaverPlaceId(link);
        if (!placeId) throw new HttpError(400, "네이버 지도 링크에서 가게를 찾지 못했어요.");
        update.naver_place_id = placeId;
      }
    }
    const { error } = await db().from("places").update(update).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/places/[id]">) {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    const { error } = await db().from("places").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
