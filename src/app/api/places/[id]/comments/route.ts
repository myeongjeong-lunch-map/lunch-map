import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { cleanText, errorResponse, guardWrite, HttpError } from "@/lib/server/guard";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/places/[id]/comments">) {
  try {
    const { id } = await ctx.params;
    const { data, error } = await db().from("comments").select("*").eq("place_id", id).order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ comments: data });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/places/[id]/comments">) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const text = cleanText(body.body, 1000);
    if (!text) throw new HttpError(400, "한마디를 입력해 주세요.");
    const { data: place } = await db().from("places").select("id").eq("id", id).maybeSingle();
    if (!place) throw new HttpError(404, "가게를 찾을 수 없어요.");
    await guardWrite(req, body);
    const { data, error } = await db()
      .from("comments")
      .insert({ place_id: id, body: text, nickname: cleanText(body.nickname, 20) })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
