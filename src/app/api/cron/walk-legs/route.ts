import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireCron } from "@/lib/server/guard";
import { refreshLegs } from "@/lib/server/walkingStore";

// 매일 한 번 산책 구간(캠퍼스↔장소, 장소↔장소)을 모두 다시 계산한다 (TMAP 데이터 24시간 보관 제한).
// 가게 크론(/api/cron/walking)과 함수 시간을 나눠 쓰지 않게 따로 돌린다. (docs/adr/0005)
export async function GET(req: NextRequest) {
  try {
    requireCron(req);
    return NextResponse.json(await refreshLegs());
  } catch (e) {
    return errorResponse(e);
  }
}
