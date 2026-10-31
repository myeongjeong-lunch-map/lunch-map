import { NextResponse, type NextRequest } from "next/server";
import { parseInstagramHandle } from "@/lib/domain";
import { errorResponse, guardWrite, HttpError } from "@/lib/server/guard";
import { db } from "@/lib/server/supabase";

// 인스타 오늘의 메뉴: 가게의 인스타그램 계정을 등록·수정한다. 누구나 할 수 있고, 빈 값이면 등록을 지운다.
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/places/[id]/instagram">) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const handle = typeof body.instagram === "string" ? parseInstagramHandle(body.instagram.slice(0, 200)) : null;
    if (handle === null) throw new HttpError(400, "인스타그램 아이디나 프로필 주소를 확인해 주세요.");
    const { data: place } = await db().from("places").select("id").eq("id", id).maybeSingle();
    if (!place) throw new HttpError(404, "가게를 찾을 수 없어요.");
    await guardWrite(req, body);
    const { error } = await db()
      .from("places")
      .update({ instagram: handle || null })
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ instagram: handle || null });
  } catch (e) {
    return errorResponse(e);
  }
}
