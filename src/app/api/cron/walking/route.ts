import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse, HttpError } from "@/lib/server/guard";
import { computeWalking } from "@/lib/server/walking";

// 매일 한 번 모든 가게의 도보 시간을 다시 계산한다 (TMAP 데이터 24시간 보관 제한).
// Vercel Cron이 Authorization: Bearer $CRON_SECRET 으로 호출한다.
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "unauthorized");
    const { data: places, error } = await db().from("places").select("id, lat, lng");
    if (error) throw error;
    let tmap = 0;
    let estimate = 0;
    for (const p of places ?? []) {
      const w = await computeWalking(p.lat, p.lng);
      if (w.source === "tmap") tmap++;
      else estimate++;
      const { error: uErr } = await db()
        .from("places")
        .update({
          walking_seconds: w.seconds,
          walking_meters: w.meters,
          walking_source: w.source,
          walking_path: w.path,
          walking_updated_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (uErr) throw uErr;
    }
    return NextResponse.json({ updated: (places ?? []).length, tmap, estimate });
  } catch (e) {
    return errorResponse(e);
  }
}
