import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireCron } from "@/lib/server/guard";
import { refreshPlaces } from "@/lib/server/walkingStore";

// 매일 한 번 모든 가게의 도보 시간을 다시 계산한다 (TMAP 데이터 24시간 보관 제한).
export async function GET(req: NextRequest) {
  try {
    requireCron(req);
    return NextResponse.json(await refreshPlaces());
  } catch (e) {
    return errorResponse(e);
  }
}
