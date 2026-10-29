import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, purgeWriteEvents, requireCron } from "@/lib/server/guard";

// 매일 한 번 30일 지난 남용 방지 기록(IP 해시)을 지운다.
export async function GET(req: NextRequest) {
  try {
    requireCron(req);
    return NextResponse.json(await purgeWriteEvents());
  } catch (e) {
    return errorResponse(e);
  }
}
