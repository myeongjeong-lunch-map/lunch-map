import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse, HttpError } from "@/lib/server/guard";
import { MAX_COURSE_STOPS } from "@/lib/domain";

const DAY_MS = 24 * 3600 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Path = [number, number][];

// 쉼표로 나눈 산책 장소 id 1~5개, 중복 없음
function parseStops(raw: string | null): string[] {
  const ids = (raw ?? "").split(",").map((x) => x.trim().toLowerCase());
  if (!raw || ids.length < 1) throw new HttpError(400, "산책 장소를 골라 주세요.");
  if (ids.length > MAX_COURSE_STOPS) throw new HttpError(400, `산책 장소는 ${MAX_COURSE_STOPS}곳까지 고를 수 있어요.`);
  if (!ids.every((id) => UUID.test(id))) throw new HttpError(400, "잘못된 산책 장소예요.");
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "같은 산책 장소를 두 번 넣을 수 없어요.");
  return ids;
}

// 캠퍼스 → 장소들 → 캠퍼스, 걷는 방향으로 이은 구간별 보행 경로 (stops.length + 1개).
// 구간이 없거나 24시간이 지났으면 path: null (TMAP 보관 제한, docs/adr/0001·0005)
export async function GET(req: NextRequest) {
  try {
    const ids = parseStops(req.nextUrl.searchParams.get("stops"));

    const { data: spots, error: sErr } = await db().from("walk_spots").select("id").in("id", ids);
    if (sErr) throw sErr;
    if ((spots ?? []).length !== ids.length) throw new HttpError(404, "산책 장소를 찾을 수 없어요.");

    // spot_a < spot_b 로 저장하므로, 코스에 든 장소끼리의 구간은 spot_b가 코스 안에 있으면 모두 잡힌다
    const { data: rows, error } = await db().from("walk_legs").select("spot_a, spot_b, path, updated_at").in("spot_b", ids);
    if (error) throw error;
    const byPair = new Map((rows ?? []).map((r) => [`${r.spot_a ?? "campus"}|${r.spot_b}`, r]));

    const points: (string | null)[] = [null, ...ids, null];
    const legs = points.slice(0, -1).map((from, i) => {
      const to = points[i + 1];
      // 저장 방향: 캠퍼스 → 장소, 장소끼리는 id가 작은 쪽 → 큰 쪽
      const forward = from === null || (to !== null && from < to);
      const row = from === null ? byPair.get(`campus|${to}`) : to === null ? byPair.get(`campus|${from}`) : forward ? byPair.get(`${from}|${to}`) : byPair.get(`${to}|${from}`);
      const fresh = row && Date.now() - new Date(row.updated_at).getTime() < DAY_MS;
      const path = fresh ? (row.path as Path | null) : null;
      return { path: path ? (forward ? path : [...path].reverse()) : null };
    });
    return NextResponse.json({ legs });
  } catch (e) {
    return errorResponse(e);
  }
}
