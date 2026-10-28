import { NextResponse, type NextRequest } from "next/server";
import { authClient, safeNext } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/guard";

// 구글 로그인 시작: 구글 동의 화면으로 보낸다. PKCE 확인 값은 Supabase가 쿠키에 넣는다.
// 구글에는 Supabase 기본 범위(이메일·기본 프로필)만 요청하고 더 넓히지 않는다 (docs/adr/0008).
export async function GET(req: NextRequest) {
  try {
    const next = safeNext(req.nextUrl.searchParams.get("next"));
    const redirectTo = new URL("/auth/callback", req.nextUrl.origin);
    redirectTo.searchParams.set("next", next);
    const { data, error } = await (await authClient()).auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString(), skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
    });
    if (error) throw error;
    return NextResponse.redirect(data.url);
  } catch (e) {
    return errorResponse(e);
  }
}
