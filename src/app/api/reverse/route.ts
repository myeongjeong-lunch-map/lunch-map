import { NextResponse, type NextRequest } from "next/server";
import { reverseGeocode } from "@/lib/server/naver";
import { errorResponse, HttpError } from "@/lib/server/guard";

export async function GET(req: NextRequest) {
  try {
    const lat = Number(req.nextUrl.searchParams.get("lat"));
    const lng = Number(req.nextUrl.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, "좌표가 필요해요.");
    return NextResponse.json({ roadAddress: await reverseGeocode(lat, lng) });
  } catch (e) {
    return errorResponse(e);
  }
}
