import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 구글 로그인 (Supabase Auth, docs/adr/0008). 세션은 Supabase가 쓰는 sb-… 쿠키에 둔다.
// 로그인 흐름도 서버에서만 돌므로 브라우저용 키를 따로 두지 않고 서버 키를 쓴다. 이 클라이언트로 DB를 읽지 않는다.
export async function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.");
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      // 세션을 새로 고치면 쿠키를 다시 쓴다. Route Handler에서만 부르므로 쓸 수 있다
      setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
}

/** 로그인한 계정의 auth.users id. 로그인하지 않았거나 세션이 만료됐으면 null */
export async function currentUserId(): Promise<string | null> {
  const store = await cookies();
  // 로그인한 적 없는 브라우저는 Supabase에 묻지 않는다
  if (!store.getAll().some((c) => c.name.startsWith("sb-"))) return null;
  const { data, error } = await (await authClient()).auth.getClaims();
  if (error || !data) return null;
  return data.claims.sub;
}

/** 로그인 뒤 돌아갈 곳. 다른 사이트로 보내지 못하게 우리 사이트 안의 경로만 받는다 */
export function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}
