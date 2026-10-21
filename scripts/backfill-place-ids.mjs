// 노션에서 옮긴 가게들에 네이버 플레이스 ID를 채운다 (노션 표의 '위치' 링크 기준).
// 사용법: node --env-file=.env.local --experimental-strip-types scripts/backfill-place-ids.mjs
import { createClient } from "@supabase/supabase-js";
import { resolveNaverPlaceId } from "../src/lib/naverPlaceId.ts";

const LINKS = {
  "시골집": "https://naver.me/GoD7FpXf",
  "장수본가해장국": "https://map.naver.com/p/entry/place/2048746409",
  "맥도날드 서초GS점": "https://naver.me/58NdAzxi",
  "허수아비 돈까스": "https://map.naver.com/p/search/x/place/11736500",
  "카츠공방 서초본점": "https://naver.me/FMcgbRZt",
  "김밥천국": "https://naver.me/FioxWAPx",
  "몬안베띠 서초본점": "https://naver.me/57VZhUfk",
  "긴자료코 서초점": "https://naver.me/5XJI97nK",
  "하오차이": "https://map.naver.com/p/search/x/place/12076191",
  "천지궁": "https://naver.me/xRhEbOuy",
  "부정부페": "https://map.naver.com/p/search/x/place/1951385205",
  "삼대나주곰탕 서초본점": "https://naver.me/IDFUcvGX",
  "왓더버거": "https://naver.me/5PlUfzKn",
  "오늘도보쌈칼국수(본점)": "https://naver.me/FTXwd3QP",
  "오늘도보쌈칼국수 서초2호점": "https://naver.me/5cq45xgc",
  "한설원 한우설렁탕": "https://naver.me/xIeXHZe1",
  "봉산옥 서초동본점": "https://naver.me/5mI0azHw",
  "백년옥": "https://naver.me/F2ZuxXWx",
  // 매머드: 노션 링크(서초쌍용플래티넘점)와 이름(남부터미널점)이 달라서 비워 둠
  "메가커피 서초3동점": "https://map.naver.com/p/search/x/place/1222600976",
  "초초베이크숍": "https://map.naver.com/p/search/x/place/31051696",
};

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

for (const [name, link] of Object.entries(LINKS)) {
  const id = await resolveNaverPlaceId(link);
  if (!id) {
    console.log(`✗ ${name}: ID를 찾지 못함 (${link})`);
    continue;
  }
  const { data, error } = await db.from("places").update({ naver_place_id: id }).eq("name", name).select("id");
  if (error) throw error;
  console.log(`${data.length ? "→" : "✗ (가게 없음)"} ${name}: ${id}`);
}
