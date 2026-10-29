import { NextResponse, type NextRequest } from "next/server";
import { authClient, safeNext } from "@/lib/server/auth";
import { accountKey, readBrowserId } from "@/lib/server/guard";
import { db } from "@/lib/server/supabase";

// 구글에서 돌아오는 곳: 세션을 만들고, 이 브라우저에 쌓인 평가·키워드·즐겨찾기·팀원 기록을 계정으로 옮긴다.
// 실패하면 ?login=failed 와 실패 이유(login_error)를 붙여 원래 화면으로 돌려보낸다.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const back = (reason?: string) => {
    const url = new URL(next, req.nextUrl.origin);
    if (reason !== undefined) {
      console.error("login failed:", reason);
      url.searchParams.set("login", "failed");
      if (reason) url.searchParams.set("login_error", reason.slice(0, 200));
    }
    return NextResponse.redirect(url);
  };
  const code = params.get("code");
  // Supabase가 구글 쪽 인증을 마치지 못하면 code 대신 error·error_description을 붙여 보낸다
  if (!code) return back(params.get("error_description") ?? params.get("error") ?? "");
  try {
    const { data, error } = await (await authClient()).auth.exchangeCodeForSession(code);
    if (error || !data.user) return back(error?.message ?? "");
    const browserId = readBrowserId(req);
    if (browserId) {
      const { error: claimErr } = await db().rpc("claim_browser", { p_from: browserId, p_to: accountKey(data.user.id) });
      // 옮기기에 실패해도 로그인은 된 것이므로 막지 않는다. 다음 로그인 때 다시 옮긴다
      if (claimErr) console.error(claimErr);
    }
    return back();
  } catch (e) {
    return back(e instanceof Error ? e.message : "");
  }
}
