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

// 산책 (GLOSSARY.md: 산책 장소, 산책 코스, 구간, 걷는 시간, 둘러보는 시간, 코스 시간)
export const MAX_COURSE_STOPS = 5;
export const WALK_SPOT_KINDS = [
  { key: "park", label: "공원", emoji: "🌳" },
  { key: "culture", label: "문화시설", emoji: "🎭" },
  { key: "trail", label: "산책길", emoji: "🌉" },
] as const;
export type WalkSpotKind = (typeof WALK_SPOT_KINDS)[number]["key"];
export const WALK_KIND_EMOJI = Object.fromEntries(WALK_SPOT_KINDS.map((k) => [k.key, k.emoji])) as Record<WalkSpotKind, string>;
export const WALK_KIND_LABEL = Object.fromEntries(WALK_SPOT_KINDS.map((k) => [k.key, k.label])) as Record<WalkSpotKind, string>;
/** 코스 시간이 이보다 길면 카드에 "점심시간엔 빠듯"을 붙인다 */
export const LUNCH_TIGHT_MINUTES = 45;

export type WalkSpot = {
  id: string;
  name: string;
  kind: WalkSpotKind;
  summary: string | null;
  lat: number;
  lng: number;
  stay_minutes: number;
  naver_place_id: string | null;
};
export type WalkCourseStop = { spot_id: string; stay_minutes: number | null };
export type WalkCourse = { id: string; name: string; summary: string | null; stops: WalkCourseStop[] };
/** a가 null이면 캠퍼스. 방향 없음 */
export type WalkLeg = { a: string | null; b: string; seconds: number; meters: number; source: "tmap" | "estimate" };

/**
 * 구간을 저장하는 방식(짝). 방향 없이 같은 쌍이면 같은 짝이다.
 * 캠퍼스(null)는 늘 a, 장소끼리는 id가 작은 쪽이 a. forward는 x → y가 저장 방향(a → b)과 같은지.
 * 이 규칙은 여기에만 있다. 서버 저장소와 legKey가 같이 쓴다.
 */
export function legPair(x: string | null, y: string | null): { a: string | null; b: string; forward: boolean } {
  if (x === null) return { a: null, b: y as string, forward: true };
  if (y === null) return { a: null, b: x, forward: false };
  return x < y ? { a: x, b: y, forward: true } : { a: y, b: x, forward: false };
}

/** 구간 찾기 키. 방향 없이 같은 쌍이면 같은 키. null(캠퍼스)은 "campus" */
export function legKey(x: string | null, y: string | null): string {
  const { a, b } = legPair(x, y);
  return `${a ?? "campus"}|${b}`;
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 직선거리에 곱해 보행 거리로 보는 값 */
const DETOUR = 1.3;
/** 시속 4km */
const WALK_METERS_PER_SECOND = 4000 / 3600;

/** TMAP을 못 쓸 때의 추정값: 직선거리 × 1.3 을 시속 4km로 걸은 값. 서버와 화면이 같이 쓴다 */
export function estimateWalk(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): { seconds: number; meters: number } {
  const meters = Math.round(haversine(from.lat, from.lng, to.lat, to.lng) * DETOUR);
  return { seconds: Math.round(meters / WALK_METERS_PER_SECOND), meters };
}

export type CourseTime = {
  /** 캠퍼스 → 1번 → … → 캠퍼스, stops.length + 1개 */
  legs: { seconds: number; meters: number; source: "tmap" | "estimate" | "missing" }[];
  walkSeconds: number;
  meters: number;
  stayMinutes: number;
  /** 걷는 분(반올림) + 둘러보는 분 */
  totalMinutes: number;
  /** 추정값이나 아직 계산 안 된 구간이 있으면 true */
  rough: boolean;
};

export function courseTime(stops: WalkCourseStop[], spots: Map<string, WalkSpot>, legs: Map<string, WalkLeg>): CourseTime {
  const points: (string | null)[] = [null, ...stops.map((s) => s.spot_id), null];
  const out: CourseTime["legs"] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x, y] = [points[i], points[i + 1]];
    const known = legs.get(legKey(x, y));
    if (known) {
      out.push({ seconds: known.seconds, meters: known.meters, source: known.source });
      continue;
    }
    const from = x ? spots.get(x) : null;
    const to = y ? spots.get(y) : null;
    const a = from ?? CAMPUS;
    const b = to ?? CAMPUS;
    out.push({ ...estimateWalk(a, b), source: "missing" });
  }
  const walkSeconds = out.reduce((n, l) => n + l.seconds, 0);
  const stayMinutes = stops.reduce((n, s) => n + (s.stay_minutes ?? spots.get(s.spot_id)?.stay_minutes ?? 0), 0);
  return {
    legs: out,
    walkSeconds,
    meters: out.reduce((n, l) => n + l.meters, 0),
    stayMinutes,
    totalMinutes: Math.round(walkSeconds / 60) + stayMinutes,
    rough: out.some((l) => l.source !== "tmap"),
  };
}

/** 캠퍼스 → 산책 장소 한 방향 걷기. 구간이 아직 없으면 직선거리로 어림잡는다 */
export function campusWalk(spot: WalkSpot, legs: Map<string, WalkLeg>): { minutes: number; meters: number; rough: boolean } {
  const known = legs.get(legKey(null, spot.id));
  const guess = known ? null : estimateWalk(CAMPUS, spot);
  const meters = known?.meters ?? guess!.meters;
  const seconds = known?.seconds ?? guess!.seconds;
  return { minutes: Math.max(1, Math.round(seconds / 60)), meters, rough: known?.source !== "tmap" };
}

/** 지도 위 칩과 카드에 쓰는 거리 문구: 640m, 1.3km */
export function formatMeters(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(1)}km`;
}

// 랭킹. "이번 주"는 최근 7일 좋아요 × 2 + 꿀팁, "전체"는 좋아요 − 싫어요. 같으면 가까운 순.
export type RankingPeriod = "week" | "all";

export const WEEK_MS = 7 * 24 * 3600 * 1000;
const WEEKLY_LIKE_POINTS = 2;
const WEEKLY_TIP_POINTS = 1;

/** 이번 주 랭킹 점수. 서버가 처음 계산할 때와 화면이 즉시 반영할 때 같은 공식을 쓴다 */
export function weeklyScore(recentLikes: number, recentTips: number): number {
  return recentLikes * WEEKLY_LIKE_POINTS + recentTips * WEEKLY_TIP_POINTS;
}

export type Ranking = {
  /** 실제로 매긴 기준. 이번 주 기록이 비어 있으면 "week"를 달라고 해도 "all"이다 */
  period: RankingPeriod;
  /** "week"를 달라고 했는데 이번 주 기록이 없어 "all"로 바뀌었는지 */
  fellBack: boolean;
  ranked: Place[];
};

export function ranking(places: Place[], period: RankingPeriod): Ranking {
  const fellBack = period === "week" && places.every((p) => p.weekly_score === 0);
  const effective: RankingPeriod = fellBack ? "all" : period;
  const score = effective === "week" ? (p: Place) => p.weekly_score : (p: Place) => p.likes - p.dislikes;
  const ranked = [...places].sort((a, b) => score(b) - score(a) || (a.walking_seconds ?? Infinity) - (b.walking_seconds ?? Infinity));
  return { period: effective, fellBack, ranked };
}

// 서버 응답을 기다리지 않고 화면에 먼저 반영하는 계산 (다시 불러오면 서버 값으로 덮인다)

/** 내 평가가 prev → next로 바뀐 가게. 좋아요가 새로 생기면 이번 주 점수가 오르고, 좋아요를 거두면 내린다(0 아래로는 안 내려간다) */
export function applyVote(place: Place, prev: MyVote, next: MyVote): Place {
  const likeDelta = (next === 1 ? 1 : 0) - (prev === 1 ? 1 : 0);
  return {
    ...place,
    likes: place.likes + likeDelta,
    dislikes: place.dislikes - (prev === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
    weekly_score: Math.max(0, place.weekly_score + weeklyScore(likeDelta, 0)),
  };
}

/** 내 키워드가 prev → next로 바뀐 가게 */
export function applyKeywords(place: Place, prev: KeywordKey[], next: KeywordKey[]): Place {
  const keywords = { ...place.keywords };
  for (const k of prev) keywords[k] = (keywords[k] ?? 1) - 1;
  for (const k of next) keywords[k] = (keywords[k] ?? 0) + 1;
  return { ...place, keywords };
}

/** 꿀팁이 하나 달린 가게 */
export function applyTip(place: Place): Place {
  return { ...place, tip_count: place.tip_count + 1, weekly_score: place.weekly_score + weeklyScore(0, 1) };
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
