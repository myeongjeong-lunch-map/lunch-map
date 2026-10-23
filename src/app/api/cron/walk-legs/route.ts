import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse, HttpError } from "@/lib/server/guard";
import { CAMPUS } from "@/lib/domain";
import { computeRoute } from "@/lib/server/walking";

// 매일 한 번 산책 구간(캠퍼스↔장소, 장소↔장소)을 모두 다시 계산한다 (TMAP 데이터 24시간 보관 제한).
// 가게 크론(/api/cron/walking)과 함수 시간을 나눠 쓰지 않게 따로 돌린다.
// Vercel Cron이 Authorization: Bearer $CRON_SECRET 으로 호출한다. (docs/adr/0005)
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "unauthorized");
    const { data: spots, error } = await db().from("walk_spots").select("id, lat, lng");
    if (error) throw error;
    const list = spots ?? [];
    let tmap = 0;
    let estimate = 0;
    let updated = 0;
    // TMAP 초당 호출 제한을 모르므로 하나씩 순서대로 부른다
    const save = async (a: string | null, b: string, from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
      const w = await computeRoute(from, to);
      if (w.source === "tmap") tmap++;
      else estimate++;
      const { error: uErr } = await db()
        .from("walk_legs")
        .upsert(
          { spot_a: a, spot_b: b, seconds: w.seconds, meters: w.meters, source: w.source, path: w.path, updated_at: new Date().toISOString() },
          { onConflict: "spot_a,spot_b" },
        );
      if (uErr) throw uErr;
      updated++;
    };
    for (const s of list) await save(null, s.id, CAMPUS, s);
    for (const a of list) {
      for (const b of list) {
        if (a.id < b.id) await save(a.id, b.id, a, b);
      }
    }
    return NextResponse.json({ updated, tmap, estimate });
  } catch (e) {
    return errorResponse(e);
  }
}
