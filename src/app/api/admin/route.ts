import { NextResponse, type NextRequest } from "next/server";
import { checkAdminSecret, errorResponse, HttpError, isAdmin, setAdminCookie } from "@/lib/server/guard";

export async function GET(req: NextRequest) {
  return NextResponse.json({ admin: isAdmin(req) });
}

// 관리자 로그인: ADMIN_SECRET이 맞으면 관리자 쿠키를 준다.
export async function POST(req: NextRequest) {
  try {
    const { secret } = (await req.json()) as { secret?: unknown };
    if (typeof secret !== "string" || !checkAdminSecret(secret)) throw new HttpError(401, "비밀 키가 맞지 않아요.");
    const res = NextResponse.json({ admin: true });
    setAdminCookie(res);
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
