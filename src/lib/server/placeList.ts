import { WEEK_MS, weeklyScore, type KeywordKey, type Place } from "@/lib/domain";
import { HALLOWEEN_START } from "@/lib/halloween";
import { db } from "@/lib/server/supabase";
import { withFreshWalking } from "@/lib/server/walkingStore";

// 가게 목록: 요약 뷰 + 키워드 수 + 이번 주 점수 + 할로윈 꿀팁 수. 화면(/api/places)과 MCP가 같이 쓴다.
// voterId를 주면 그 브라우저가 고른 키워드도 같이 돌려준다.
export async function readPlaceList(voterId: string | null): Promise<{ places: Place[]; myKeywords: Record<string, KeywordKey[]> }> {
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const [summaries, keywords, weekLikes, weekTips, eventTips, preorders, toTry, instagrams] = await Promise.all([
    db().from("place_summaries").select("*"),
    db().from("place_keywords").select("place_id, keyword, voter_id"),
    db().from("votes").select("place_id").eq("value", 1).gte("updated_at", since),
    db().from("tips").select("place_id").gte("created_at", since),
    db().from("tips").select("place_id").gte("created_at", new Date(HALLOWEEN_START).toISOString()),
    // place_summaries 뷰는 새 칸을 모르므로 따로 읽는다. 칸이 없는 옛 DB에서는 모두 미리 주문이 아니다
    db().from("places").select("id").eq("preorder", true),
    db().from("places").select("id").eq("to_try", true),
    db().from("places").select("id, instagram").not("instagram", "is", null),
  ]);
  for (const r of [summaries, keywords, weekLikes, weekTips, eventTips]) if (r.error) throw r.error;
  const preorderIds = new Set((preorders.data ?? []).map((p) => p.id));
  const toTryIds = new Set((toTry.data ?? []).map((p) => p.id));
  const instagramOf = new Map((instagrams.data ?? []).map((p) => [p.id as string, p.instagram as string]));

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
    preorder: preorderIds.has(p.id),
    to_try: toTryIds.has(p.id) && p.tip_count === 0,
    instagram: instagramOf.get(p.id) ?? null,
    keywords: keywordCounts.get(p.id) ?? {},
    weekly_score: weeklyScore(recentLikes.get(p.id) ?? 0, recentTips.get(p.id) ?? 0),
    event_tips: eventCount.get(p.id) ?? 0,
  }));

  return { places, myKeywords };
}
