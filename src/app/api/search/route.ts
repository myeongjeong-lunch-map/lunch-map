import { NextResponse, type NextRequest } from "next/server";
import { CAMPUS, haversine } from "@/lib/domain";
import { searchLocal, type SearchResult } from "@/lib/server/naver";
import { errorResponse, HttpError } from "@/lib/server/guard";

const MAX_RESULTS = 5;
/** 캠퍼스 3km 안의 동네. 검색어에 이 이름이 없으면 붙여서 한 번씩 더 찾는다 */
const NEAR_AREAS = ["서초", "반포", "방배", "양재"];
const AREA_IN_QUERY = /서초|반포|방배|양재|잠원|남부터미널|교대/;

// 가게 검색: 네이버 지역 검색은 한 번에 5개만 주고 위치를 받지 않아서, 그대로 검색과 동네 이름을 붙인 검색을 함께 돌려 합친 뒤
// 캠퍼스에서 가까운 순으로 줄 세운다. 그래서 3km 안의 가게가 먼저 나온다. 화면은 meters로 먼 곳을 흐리게 표시한다.
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 40);
    if (!q) throw new HttpError(400, "검색어를 입력해 주세요.");
    const queries = AREA_IN_QUERY.test(q) ? [q] : [q, ...NEAR_AREAS.map((a) => `${q} ${a}`)];
    const settled = await Promise.allSettled(queries.map((x) => searchLocal(x)));
    const lists = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    if (!lists.length) throw (settled[0] as PromiseRejectedResult).reason;

    const seen = new Map<string, SearchResult & { meters: number }>();
    for (const r of lists.flat()) {
      const key = `${r.name}|${r.roadAddress}`;
      if (!seen.has(key)) seen.set(key, { ...r, meters: Math.round(haversine(CAMPUS.lat, CAMPUS.lng, r.lat, r.lng)) });
    }
    const results = [...seen.values()].sort((a, b) => a.meters - b.meters).slice(0, MAX_RESULTS);
    return NextResponse.json({ results });
  } catch (e) {
    return errorResponse(e);
  }
}
