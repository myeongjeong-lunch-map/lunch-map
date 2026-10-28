import { NextResponse } from "next/server";
import { authClient } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/guard";

// 로그아웃: 이 브라우저의 세션 쿠키만 지운다. 다른 기기의 로그인은 그대로 둔다
export async function POST() {
  try {
    await (await authClient()).auth.signOut({ scope: "local" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
