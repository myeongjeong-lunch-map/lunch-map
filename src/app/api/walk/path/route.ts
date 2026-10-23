import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse, HttpError } from "@/lib/server/guard";
import { MAX_COURSE_STOPS } from "@/lib/domain";
import { readCoursePaths } from "@/lib/server/walkingStore";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const paths = await readCoursePaths(ids);
    const legs = paths.map((path) => ({ path }));
    return NextResponse.json({ legs });
  } catch (e) {
    return errorResponse(e);
  }
}
