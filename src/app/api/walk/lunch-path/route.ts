import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse, HttpError } from "@/lib/server/guard";
import { readCoursePaths, readPlaceLegPath, readPlacePath } from "@/lib/server/walkingStore";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 점심 코스 지도에 그릴 세 구간의 보행 경로: 캠퍼스 → 가게, 가게 → 산책 장소, 산책 장소 → 캠퍼스.
// 구간이 없거나 24시간이 지났으면 path: null (TMAP 보관 제한, docs/adr/0001·0006). 가게 → 산책 장소는 크론이 그 쌍을 계산하기 전에 null이다.
// mode는 두 방식이 같은 세 구간을 쓰므로 값만 검사한다.
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const place = q.get("place") ?? "";
    const spot = q.get("spot") ?? "";
    if (!UUID.test(place) || !UUID.test(spot)) throw new HttpError(400, "가게와 산책 장소를 골라 주세요.");
    if (q.get("mode") !== "dine" && q.get("mode") !== "takeout") throw new HttpError(400, "먹고 걷기와 포장해서 먹기 중에서 골라 주세요.");

    const { data: spotRow, error } = await db().from("walk_spots").select("id").eq("id", spot).maybeSingle();
    if (error) throw error;
    if (!spotRow) throw new HttpError(404, "산책 장소를 찾을 수 없어요.");

    const [toPlace, between, courseLegs] = await Promise.all([readPlacePath(place), readPlaceLegPath(place, spot), readCoursePaths([spot])]);
    if (toPlace === undefined) throw new HttpError(404, "가게를 찾을 수 없어요.");
    return NextResponse.json({ legs: [{ path: toPlace }, { path: between }, { path: courseLegs[1] ?? null }] });
  } catch (e) {
    return errorResponse(e);
  }
}
