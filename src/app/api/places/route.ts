import { NextResponse, type NextRequest } from "next/server";
import { isCategory, isKeyword, MAX_KEYWORDS_PER_PLACE, WEEK_MS, weeklyScore, type KeywordKey, type MyVote, type Place } from "@/lib/domain";
import { db } from "@/lib/server/supabase";
import { cleanText, ensureVoterId, errorResponse, guardWrite, HttpError, readVoterId } from "@/lib/server/guard";
import { computePlaceWalking, withFreshWalking } from "@/lib/server/walkingStore";
import { resolveNaverPlaceId } from "@/lib/naverPlaceId";
import { HALLOWEEN_START } from "@/lib/halloween";

export async function GET(req: NextRequest) {
  try {
    const since = new Date(Date.now() - WEEK_MS).toISOString();
    const [summaries, keywords, weekLikes, weekTips, eventTips] = await Promise.all([
      db().from("place_summaries").select("*"),
      db().from("place_keywords").select("place_id, keyword, voter_id"),
      db().from("votes").select("place_id").eq("value", 1).gte("updated_at", since),
      db().from("tips").select("place_id").gte("created_at", since),
      db().from("tips").select("place_id").gte("created_at", new Date(HALLOWEEN_START).toISOString()),
    ]);
    for (const r of [summaries, keywords, weekLikes, weekTips, eventTips]) if (r.error) throw r.error;

    const voterId = readVoterId(req);
    const keywordCounts = new Map<string, Partial<Record<KeywordKey, number>>>();
    const myKeywords: Record<string, KeywordKey[]> = {};
    for (const k of keywords.data ?? []) {
      const counts = keywordCounts.get(k.place_id) ?? {};
      counts[k.keyword as KeywordKey] = (counts[k.keyword as KeywordKey] ?? 0) + 1;
      keywordCounts.set(k.place_id, counts);
      if (voterId && k.voter_id === voterId) (myKeywords[k.place_id] ??= []).push(k.keyword as KeywordKey);
    }
    const recentLikes = new Map<string, number>();
    for (const v of weekLikes.data ?? []) recentLikes.set(v.place_id, (recentLikes.get(v.place_id) ?? 0) + 1);
    const recentTips = new Map<string, number>();
    for (const t of weekTips.data ?? []) recentTips.set(t.place_id, (recentTips.get(t.place_id) ?? 0) + 1);

    const eventCount = new Map<string, number>();
    for (const t of eventTips.data ?? []) eventCount.set(t.place_id, (eventCount.get(t.place_id) ?? 0) + 1);

    const places: Place[] = (summaries.data ?? []).map((p) => ({
      ...withFreshWalking(p),
      keywords: keywordCounts.get(p.id) ?? {},
      weekly_score: weeklyScore(recentLikes.get(p.id) ?? 0, recentTips.get(p.id) ?? 0),
      event_tips: eventCount.get(p.id) ?? 0,
    }));

    const myVotes: Record<string, MyVote> = {};
    if (voterId) {
      const { data: votes, error } = await db().from("votes").select("place_id, value").eq("voter_id", voterId);
      if (error) throw error;
      for (const v of votes ?? []) myVotes[v.place_id] = v.value as MyVote;
    }
    const res = NextResponse.json({ places, myVotes, myKeywords });
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
    const tipBody = cleanText(body.tip, 1000);
    const nickname = cleanText(body.nickname, 20);
    const keywords = Array.isArray(body.keywords) ? [...new Set(body.keywords.filter(isKeyword))].slice(0, MAX_KEYWORDS_PER_PLACE) : [];

    const { data: existing } = await db().from("places").select("id").eq("name", name).eq("road_address", roadAddress).maybeSingle();
    if (existing) return NextResponse.json({ error: "이미 등록된 가게예요.", placeId: existing.id }, { status: 409 });

    await guardWrite(req, body);
    const naverLink = cleanText(body.naverLink, 500);
    const naverPlaceId = naverLink ? await resolveNaverPlaceId(naverLink) : null;
    if (naverLink && !naverPlaceId) throw new HttpError(400, "네이버 지도 링크에서 가게를 찾지 못했어요. 링크를 확인하거나 비워 두세요.");
    const walking = await computePlaceWalking(lat, lng);
    const { data: place, error } = await db()
      .from("places")
      .insert({
        name,
        road_address: roadAddress,
        lat,
        lng,
        category: body.category,
        naver_category: cleanText(body.naverCategory, 100),
        naver_place_id: naverPlaceId,
        ...walking,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new HttpError(409, "이미 등록된 가게예요.");
      throw error;
    }
    const res = NextResponse.json({ id: place.id }, { status: 201 });
    if (tipBody) {
      const { error: tErr } = await db().from("tips").insert({ place_id: place.id, body: tipBody, nickname });
      if (tErr) throw tErr;
    }
    if (keywords.length) {
      const voterId = ensureVoterId(req, res);
      const { error: kErr } = await db()
        .from("place_keywords")
        .insert(keywords.map((keyword) => ({ place_id: place.id, voter_id: voterId, keyword })));
      if (kErr) throw kErr;
    }
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
