import { NextResponse, type NextRequest } from "next/server";
import { authClient, safeNext } from "@/lib/server/auth";
import { accountKey, readBrowserId } from "@/lib/server/guard";
import { db } from "@/lib/server/supabase";

// 구글에서 돌아오는 곳: 세션을 만들고, 이 브라우저에 쌓인 평가·키워드·즐겨찾기·팀원 기록을 계정으로 옮긴다.
// 실패하면 ?login=failed 를 붙여 원래 화면으로 돌려보낸다.
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const back = (failed: boolean) => {
    const url = new URL(next, req.nextUrl.origin);
    if (failed) url.searchParams.set("login", "failed");
    return NextResponse.redirect(url);
  };
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return back(true);
  try {
    const { data, error } = await (await authClient()).auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error(error);
      return back(true);
    }
    const browserId = readBrowserId(req);
    if (browserId) {
      const { error: claimErr } = await db().rpc("claim_browser", { p_from: browserId, p_to: accountKey(data.user.id) });
      // 옮기기에 실패해도 로그인은 된 것이므로 막지 않는다. 다음 로그인 때 다시 옮긴다
      if (claimErr) console.error(claimErr);
    }
    return back(false);
  } catch (e) {
    console.error(e);
    return back(true);
  }
}
