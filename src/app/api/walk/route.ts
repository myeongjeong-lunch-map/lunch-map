import { connection, NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/guard";
import { readWalkData } from "@/lib/server/walkData";

// 산책 장소·추천 코스·구간(시간·거리)·가게 구간. 경로 좌표는 빼고 보낸다 (GET /api/walk/path 에서 따로 받는다)
export async function GET() {
  try {
    await connection();
    return NextResponse.json(await readWalkData());
  } catch (e) {
    return errorResponse(e);
  }
}
