// 용어 정의는 GLOSSARY.md 참고.

export const CATEGORIES = ["한식", "중식", "일식", "양식", "아시안", "분식", "패스트푸드", "카페", "기타"] as const;
export type Category = (typeof CATEGORIES)[number];

// 키워드: 노션 비고에서 반복해서 나온 관심사 8개. 브라우저 하나가 가게마다 최대 5개 고른다.
export const KEYWORDS = [
  { key: "tasty", label: "😋 맛있음" },
  { key: "value", label: "💸 가성비" },
  { key: "portion", label: "🍚 양 많음" },
  { key: "fast", label: "⚡ 빨리 나옴" },
  { key: "solo", label: "🙋 혼밥 OK" },
  { key: "group", label: "👥 단체 OK" },
  { key: "nowait", label: "🕐 웨이팅 없음" },
  { key: "takeout", label: "🥡 포장 OK" },
] as const;
export type KeywordKey = (typeof KEYWORDS)[number]["key"];
export const MAX_KEYWORDS_PER_PLACE = 5;
export const KEYWORD_LABEL = Object.fromEntries(KEYWORDS.map((k) => [k.key, k.label])) as Record<KeywordKey, string>;

// 캠퍼스: 서울 서초구 반포대로 45 명정빌딩 (네이버 Geocoding 결과)
export const CAMPUS = { name: "명정빌딩", lat: 37.4845457, lng: 127.0108578 };

export type Place = {
  id: string;
  name: string;
  road_address: string;
  lat: number;
  lng: number;
  category: Category;
  naver_category: string | null;
  naver_place_id: string | null;
  walking_seconds: number | null;
  walking_meters: number | null;
  walking_source: "tmap" | "estimate" | null;
  likes: number;
  dislikes: number;
  tip_count: number;
  /** 키워드별로 고른 사람 수 */
  keywords: Partial<Record<KeywordKey, number>>;
  /** 이번 주 랭킹 점수: 최근 7일 좋아요 × 2 + 최근 7일 꿀팁 수 */
  weekly_score: number;
  created_at: string;
};

export type Tip = {
  id: string;
  place_id: string;
  nickname: string | null;
  body: string;
  created_at: string;
};

export type MyVote = 1 | -1 | 0;

export function walkingMinutes(place: Pick<Place, "walking_seconds">): number | null {
  return place.walking_seconds == null ? null : Math.max(1, Math.round(place.walking_seconds / 60));
}

// 랭킹. "전체"는 좋아요 − 싫어요. 같으면 가까운 순.
export type RankingPeriod = "week" | "all";

export function rankPlaces(places: Place[], period: RankingPeriod): Place[] {
  const score = period === "week" ? (p: Place) => p.weekly_score : (p: Place) => p.likes - p.dislikes;
  return [...places].sort((a, b) => score(b) - score(a) || (a.walking_seconds ?? Infinity) - (b.walking_seconds ?? Infinity));
}

export function topKeyword(place: Place): { key: KeywordKey; count: number } | null {
  let best: { key: KeywordKey; count: number } | null = null;
  for (const k of KEYWORDS) {
    const count = place.keywords[k.key] ?? 0;
    if (count > 0 && (!best || count > best.count)) best = { key: k.key, count };
  }
  return best;
}

// 네이버 지도에서 가게 열기. 플레이스 ID가 있으면 그 가게로 바로, 없으면 "이름 + 구"로 검색한다.
// (도로명 주소 전체를 붙이면 "…1층" 같은 꼬리 때문에 검색 결과가 없어진다)
export function naverMapUrl(place: Pick<Place, "name" | "road_address" | "naver_place_id">): string {
  if (place.naver_place_id) return `https://map.naver.com/p/entry/place/${place.naver_place_id}`;
  const district = place.road_address.split(" ").find((w) => /[구군]$/.test(w)) ?? "";
  return `https://map.naver.com/p/search/${encodeURIComponent(`${place.name} ${district}`.trim())}`;
}

// 네이버 장소 카테고리("음식점>일식>돈가스")를 우리 카테고리로 추정한다.
export function guessCategory(naverCategory: string | null | undefined): Category {
  const c = naverCategory ?? "";
  if (/카페|디저트|커피|베이커리|제과/.test(c)) return "카페";
  if (/햄버거|패스트푸드|피자|치킨/.test(c)) return "패스트푸드";
  if (/분식|김밥|떡볶이/.test(c)) return "분식";
  if (/중식|중국/.test(c)) return "중식";
  if (/일식|돈가스|돈까스|초밥|우동|라멘|일본/.test(c)) return "일식";
  if (/베트남|태국|아시아|인도|쌀국수/.test(c)) return "아시안";
  if (/양식|이탈리아|파스타|스테이크|멕시코/.test(c)) return "양식";
  if (/한식|국밥|곰탕|설렁탕|칼국수|해장국|찌개|백반|두부|한정식|뷔페/.test(c)) return "한식";
  return "기타";
}

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

export function isKeyword(v: unknown): v is KeywordKey {
  return typeof v === "string" && KEYWORDS.some((k) => k.key === v);
}

// 꿀팁/키워드/평가가 몇 분 전인지 사람이 읽기 좋게
export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

// 추첨: 팀의 추첨통에 든 가게 가운데 하나를 넣은 횟수(가중치)에 비례해 뽑는다. 결과는 서버가 정한다 (ADR 0004).
// 다시 뽑을 때는 앞 회차에 뽑힌 가게를 빼고, 조장이 결정하면 추첨통이 닫힌다.
export const DRAW_LIMITS = [1, 2, 3] as const;
export type DrawLimit = (typeof DRAW_LIMITS)[number];
export const DRAW_ANIMATIONS = [
  { key: "race", label: "🏇 경주" },
  { key: "plinko", label: "🎯 플링코" },
] as const;
export type DrawAnimation = (typeof DRAW_ANIMATIONS)[number]["key"];
export const MIN_DRAW_PLACES = 2;

export function isDrawLimit(v: unknown): v is DrawLimit {
  return DRAW_LIMITS.includes(v as DrawLimit);
}

export function isDrawAnimation(v: unknown): v is DrawAnimation {
  return DRAW_ANIMATIONS.some((a) => a.key === v);
}

/** 팀 목록 한 줄. 내가 팀원이면 열린 추첨통 정보도 담는다. */
export type TeamSummary = {
  id: string;
  name: string;
  member_count: number;
  is_member: boolean;
  is_leader: boolean;
  /** 내가 팀원이고 추첨통이 열려 있으면: 추첨통 ID, 내가 더 넣을 수 있는 횟수, 첫 추첨을 해서 더 넣을 수 없는지 */
  open_box: { id: string; remaining: number; locked: boolean } | null;
};

// 팀원 ID는 브라우저 쿠키 값이라 화면으로 보내지 않는다. 닉네임과 "나인지"만 보낸다.
export type TeamMember = { nickname: string; is_leader: boolean; is_me: boolean };

export type DrawEntry = { id: string; place_id: string; nickname: string; is_mine: boolean };

/** 회차 하나의 결과. 1회차가 첫 추첨이고, 다시 뽑을 때마다 늘어난다. */
export type DrawResult = { id: string; round: number; place_id: string | null; animation: DrawAnimation; drawn_at: string };

export type DrawBox = {
  id: string;
  per_member_limit: DrawLimit;
  /** drawn: 조장이 결정해서 닫힘(추첨 기록), cancelled: 취소 */
  status: "open" | "drawn" | "cancelled";
  /** 결정한 가게와 결정한 시각 (status가 drawn일 때) */
  result_place_id: string | null;
  drawn_at: string | null;
  entries: DrawEntry[];
  /** 회차별 결과, 1회차부터 */
  results: DrawResult[];
};

export type TeamDetail = {
  id: string;
  name: string;
  members: TeamMember[];
  is_member: boolean;
  is_leader: boolean;
  open_box: DrawBox | null;
  /** 추첨 기록: 최근에 뽑은 추첨통부터 */
  records: DrawBox[];
};

/** 다음 회차(또는 주어진 회차)의 후보: 그 앞 회차에 뽑힌 가게를 뺀 추첨통 내용 */
export function drawCandidates<E extends Pick<DrawEntry, "place_id">>(entries: E[], results: Pick<DrawResult, "round" | "place_id">[], round = results.length + 1): E[] {
  const drawn = new Set(results.filter((r) => r.round < round).map((r) => r.place_id));
  return entries.filter((e) => !drawn.has(e.place_id));
}

/** 추첨통을 가게별 가중치로 묶는다. 많이 넣은 가게부터. */
export function drawWeights(entries: Pick<DrawEntry, "place_id">[]): { place_id: string; weight: number }[] {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.place_id, (m.get(e.place_id) ?? 0) + 1);
  return [...m].map(([place_id, weight]) => ({ place_id, weight })).sort((a, b) => b.weight - a.weight);
}
