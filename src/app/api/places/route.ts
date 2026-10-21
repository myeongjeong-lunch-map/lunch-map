import { NextResponse, type NextRequest } from "next/server";
import { isCategory, isSoloDining, type MyVote } from "@/lib/domain";
import { db } from "@/lib/server/supabase";
import { cleanText, ensureVoterId, errorResponse, guardWrite, HttpError, readVoterId } from "@/lib/server/guard";
import { computeWalking } from "@/lib/server/walking";
import { resolveNaverPlaceId } from "@/lib/naverPlaceId";

export async function GET(req: NextRequest) {
  try {
    const { data: places, error } = await db().from("place_summaries").select("*").order("walking_seconds", { ascending: true, nullsFirst: false });
    if (error) throw error;
    const voterId = readVoterId(req);
    const myVotes: Record<string, MyVote> = {};
    if (voterId) {
      const { data: votes, error: vErr } = await db().from("votes").select("place_id, value").eq("voter_id", voterId);
      if (vErr) throw vErr;
      for (const v of votes ?? []) myVotes[v.place_id] = v.value as MyVote;
    }
    const res = NextResponse.json({ places, myVotes });
    ensureVoterId(req, res);
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

// 가게 추가. 이름 + 도로명 주소가 같으면 같은 가게로 보고 409와 기존 가게 id를 돌려준다.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const name = cleanText(body.name, 60);
    const roadAddress = cleanText(body.roadAddress, 200);
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!name || !roadAddress) throw new HttpError(400, "가게 이름과 주소가 필요해요.");
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat - 37.48) > 0.2 || Math.abs(lng - 127.01) > 0.2) {
      throw new HttpError(400, "캠퍼스 근처의 위치만 등록할 수 있어요.");
    }
    if (!isCategory(body.category)) throw new HttpError(400, "카테고리를 골라 주세요.");
    const solo = isSoloDining(body.soloDining) ? body.soloDining : "unknown";
    const commentBody = cleanText(body.comment, 1000);
    const nickname = cleanText(body.nickname, 20);

    const { data: existing } = await db().from("places").select("id").eq("name", name).eq("road_address", roadAddress).maybeSingle();
    if (existing) return NextResponse.json({ error: "이미 등록된 가게예요.", placeId: existing.id }, { status: 409 });

    await guardWrite(req, body);
    const naverLink = cleanText(body.naverLink, 500);
    const naverPlaceId = naverLink ? await resolveNaverPlaceId(naverLink) : null;
    if (naverLink && !naverPlaceId) throw new HttpError(400, "네이버 지도 링크에서 가게를 찾지 못했어요. 링크를 확인하거나 비워 두세요.");
    const walking = await computeWalking(lat, lng);
    const { data: place, error } = await db()
      .from("places")
      .insert({
        name,
        road_address: roadAddress,
        lat,
        lng,
        category: body.category,
        solo_dining: solo,
        naver_category: cleanText(body.naverCategory, 100),
        naver_place_id: naverPlaceId,
        walking_seconds: walking.seconds,
        walking_meters: walking.meters,
        walking_source: walking.source,
        walking_updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new HttpError(409, "이미 등록된 가게예요.");
      throw error;
    }
    if (commentBody) {
      const { error: cErr } = await db().from("comments").insert({ place_id: place.id, body: commentBody, nickname });
      if (cErr) throw cErr;
    }
    return NextResponse.json({ id: place.id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
