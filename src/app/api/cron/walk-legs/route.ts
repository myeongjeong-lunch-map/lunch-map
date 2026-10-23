import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireCron } from "@/lib/server/guard";
import { refreshLegs, refreshPlaceLegs } from "@/lib/server/walkingStore";

// 매일 한 번 산책 구간(캠퍼스↔장소, 장소↔장소)을 모두 다시 계산한다 (TMAP 데이터 24시간 보관 제한).
// 이어서 점심 코스에 들어올 수 있는 가게 ↔ 산책 장소 쌍(가게 구간)도 다시 계산한다. 가게 값을 쓰므로 가게 크론 뒤에 돈다.
// 가게 크론(/api/cron/walking)과 함수 시간을 나눠 쓰지 않게 따로 돌린다. (docs/adr/0005, 0006)
export async function GET(req: NextRequest) {
  try {
    requireCron(req);
    const legs = await refreshLegs();
    const placeLegs = await refreshPlaceLegs();
    return NextResponse.json({ ...legs, placeLegs });
  } catch (e) {
    return errorResponse(e);
  }
}
