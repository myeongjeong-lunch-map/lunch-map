import { db } from "@/lib/server/supabase";
import { readLegs, readPlaceLegs } from "@/lib/server/walkingStore";
import type { PlaceLeg, WalkCourse, WalkLeg, WalkSpot } from "@/lib/domain";

export type WalkData = { spots: WalkSpot[]; courses: WalkCourse[]; legs: WalkLeg[]; placeLegs: PlaceLeg[] };

// 산책 장소·추천 코스·구간(시간·거리)·가게 구간. 경로 좌표는 뺀다. 화면(/api/walk)과 MCP가 같이 쓴다.
export async function readWalkData(): Promise<WalkData> {
  const [spots, courses, stops, legs, placeLegs] = await Promise.all([
    // picnic 칸이 없는 옛 DB에서도 산책 화면이 열리도록 칸을 하나하나 고르지 않는다
    db().from("walk_spots").select("*").order("created_at"),
    db().from("walk_courses").select("id, name, summary").order("sort_order").order("created_at"),
    db().from("walk_course_stops").select("course_id, position, spot_id, stay_minutes").order("position"),
    readLegs(),
    readPlaceLegs(),
  ]);
  for (const r of [spots, courses, stops]) if (r.error) throw r.error;
  const stopsByCourse = new Map<string, WalkCourse["stops"]>();
  for (const s of stops.data ?? []) {
    const list = stopsByCourse.get(s.course_id) ?? [];
    list.push({ spot_id: s.spot_id, stay_minutes: s.stay_minutes });
    stopsByCourse.set(s.course_id, list);
  }
  return {
    spots: (spots.data ?? []).map((s): WalkSpot => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      summary: s.summary,
      lat: s.lat,
      lng: s.lng,
      stay_minutes: s.stay_minutes,
      naver_place_id: s.naver_place_id,
      picnic: !!s.picnic,
    })),
    courses: (courses.data ?? []).map((c): WalkCourse => ({ id: c.id, name: c.name, summary: c.summary, stops: stopsByCourse.get(c.id) ?? [] })),
    legs,
    placeLegs,
  };
}
