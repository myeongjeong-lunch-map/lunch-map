import { connection, NextResponse } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse } from "@/lib/server/guard";
import { readLegs } from "@/lib/server/walkingStore";
import type { WalkCourse, WalkSpot } from "@/lib/domain";

// 산책 장소·추천 코스·구간(시간·거리). 경로 좌표는 빼고 보낸다 (GET /api/walk/path 에서 따로 받는다)
export async function GET() {
  try {
    await connection();
    const [spots, courses, stops, legs] = await Promise.all([
      db().from("walk_spots").select("id, name, kind, summary, lat, lng, stay_minutes, naver_place_id").order("created_at"),
      db().from("walk_courses").select("id, name, summary").order("sort_order").order("created_at"),
      db().from("walk_course_stops").select("course_id, position, spot_id, stay_minutes").order("position"),
      readLegs(),
    ]);
    for (const r of [spots, courses, stops]) if (r.error) throw r.error;
    const stopsByCourse = new Map<string, WalkCourse["stops"]>();
    for (const s of stops.data ?? []) {
      const list = stopsByCourse.get(s.course_id) ?? [];
      list.push({ spot_id: s.spot_id, stay_minutes: s.stay_minutes });
      stopsByCourse.set(s.course_id, list);
    }
    return NextResponse.json({
      spots: (spots.data ?? []) as WalkSpot[],
      courses: (courses.data ?? []).map((c): WalkCourse => ({ id: c.id, name: c.name, summary: c.summary, stops: stopsByCourse.get(c.id) ?? [] })),
      legs,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
