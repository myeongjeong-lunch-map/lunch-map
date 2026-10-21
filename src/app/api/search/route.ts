import { NextResponse, type NextRequest } from "next/server";
import { searchLocal } from "@/lib/server/naver";
import { errorResponse, HttpError } from "@/lib/server/guard";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q) throw new HttpError(400, "검색어를 입력해 주세요.");
    // 캠퍼스 근처 결과가 먼저 나오도록 지역명을 붙여 검색한다.
    const query = /서초|반포|남부터미널|교대/.test(q) ? q : `${q} 서초`;
    const results = await searchLocal(query.slice(0, 50));
    return NextResponse.json({ results });
  } catch (e) {
    return errorResponse(e);
  }
}
