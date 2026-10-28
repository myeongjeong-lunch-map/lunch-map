import { NextResponse, type NextRequest } from "next/server";
import { currentUserId } from "@/lib/server/auth";
import { cleanText, errorResponse, HttpError } from "@/lib/server/guard";
import { db } from "@/lib/server/supabase";

// 내 계정: 로그인했는지와 계정 닉네임만 돌려준다. 이메일·이름·사진은 내보내지 않는다 (docs/adr/0008)
export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ account: null });
    const { data, error } = await db().from("profiles").select("nickname").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ account: { nickname: data?.nickname ?? null } });
  } catch (e) {
    return errorResponse(e);
  }
}

// 계정 닉네임 저장. 다른 기기에서 로그인하면 이 닉네임을 채운다
export async function PUT(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) throw new HttpError(401, "로그인해야 저장할 수 있어요.");
    const body = (await req.json()) as Record<string, unknown>;
    const nickname = cleanText(body.nickname, 20);
    if (!nickname) throw new HttpError(400, "닉네임을 적어 주세요.");
    const { error } = await db().from("profiles").upsert({ user_id: userId, nickname, updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
