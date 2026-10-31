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
  /** 앱으로 미리 주문해 두고 받기만 하는 가게 (관리자가 표시). 포장해서 먹기에서 기다리는 시간이 짧다 */
  preorder: boolean;
  /** 가 볼 곳: 아직 안 가 본 채로 등록했고 꿀팁이 하나도 없다. 랭킹·추천에서 빠지고, 첫 꿀팁이 달리면 정식 가게가 된다 */
  to_try: boolean;
  /** 오늘의 메뉴를 올리는 인스타그램 계정 아이디 (누구나 등록). 없으면 null */
  instagram: string | null;
  likes: number;
  dislikes: number;
  tip_count: number;
  /** 키워드별로 고른 사람 수 */
  keywords: Partial<Record<KeywordKey, number>>;
  /** 이번 주 랭킹 점수: 최근 7일 좋아요 × 2 + 최근 7일 꿀팁 수 */
  weekly_score: number;
  /** 할로윈 이벤트 기간(lib/halloween.ts)에 남긴 꿀팁 수. 0이면 유령 가게 */
  event_tips: number;
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

export type WalkSpot = {
  id: string;
  name: string;
  kind: WalkSpotKind;
  summary: string | null;
  lat: number;
  lng: number;
  stay_minutes: number;
  naver_place_id: string | null;
  /** 포장해서 먹을 수 있는 곳 (벤치·광장이 있고 음식을 먹어도 된다) */
  picnic: boolean;
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

// 점심 코스 (GLOSSARY.md: 점심시간, 점심 코스, 가게 구간, 복귀 시각, 미리 주문, docs/design/lunch-walk.md)
export const LUNCH_START = { h: 12, m: 50 };
export const LUNCH_MINUTES = 70; // 12:50 ~ 14:00
export const DINE_IN_MINUTES = 40; // 먹고 걷기: 자리에서 일어나 가게를 나설 때까지 (가게까지 걷기 포함)
export const TAKEOUT_WAIT_MINUTES = 10; // 포장 대기
export const PREORDER_WAIT_MINUTES = 2; // 미리 주문한 가게에서 받기
export const PICNIC_EAT_MINUTES = 20; // 산책 장소에서 먹기
/** 들고 가서 먹기 좋은 카테고리. 다른 카테고리 가게는 미리 주문이나 "포장 OK" 키워드로 들어온다 */
export const TAKEOUT_CATEGORIES: readonly Category[] = ["패스트푸드", "분식"];

const LUNCH_START_MINUTES = LUNCH_START.h * 60 + LUNCH_START.m;
const LUNCH_END_MINUTES = LUNCH_START_MINUTES + LUNCH_MINUTES;

export type LunchMode = "dine" | "takeout";
export const LUNCH_MODES = [
  { key: "dine", label: "🚶 먹고 걷기" },
  { key: "takeout", label: "🥡 포장해서 먹기" },
] as const satisfies readonly { key: LunchMode; label: string }[];
/** 가게 ↔ 산책 장소 구간 (TMAP 값만 저장한다) */
export type PlaceLeg = { place_id: string; spot_id: string; seconds: number; meters: number; source: "tmap" };
export const placeLegKey = (placeId: string, spotId: string) => `${placeId}|${spotId}`;

/** 포장해서 먹기에 쓸 수 있는 가게: 패스트푸드·분식, 미리 주문, "포장 OK" 키워드를 1명 이상 골랐음 */
export function isTakeoutPlace(p: Pick<Place, "category" | "preorder" | "keywords">): boolean {
  return TAKEOUT_CATEGORIES.includes(p.category) || p.preorder || (p.keywords.takeout ?? 0) >= 1;
}

/**
 * 가게 구간(초)의 범위. 캠퍼스를 거쳐 가는 길보다 길 수 없고, 두 값의 차이보다 짧을 수 없다.
 * cp: 캠퍼스 → 가게, cs: 캠퍼스 → 산책 장소 (초)
 */
export function placeLegBounds(cp: number, cs: number): { min: number; max: number } {
  return { min: Math.abs(cs - cp), max: cp + cs };
}

/** 점심 코스 한 번에 걸리는 시간(초). 가게·산책 장소·가게 구간이 정해진 뒤의 합 */
export type LunchInput = {
  /** 캠퍼스 → 가게 */
  cp: number;
  /** 캠퍼스 → 산책 장소 (돌아오는 길도 같은 값) */
  cs: number;
  /** 가게 → 산책 장소 */
  ps: number;
  /** 산책 장소 기본 둘러보기 (분). 먹고 걷기에서만 쓴다 */
  stay: number;
  preorder: boolean;
};

export const takeoutWaitMinutes = (preorder: boolean) => (preorder ? PREORDER_WAIT_MINUTES : TAKEOUT_WAIT_MINUTES);

export function lunchSeconds(mode: LunchMode, v: LunchInput): number {
  // 먹고 걷기는 가게까지 걷기가 식사 40분 안에 들어 있어 cp를 더하지 않는다. 포장은 먹는 20분이 둘러보기를 대신한다
  return mode === "dine"
    ? DINE_IN_MINUTES * 60 + v.ps + v.stay * 60 + v.cs
    : v.cp + takeoutWaitMinutes(v.preorder) * 60 + v.ps + PICNIC_EAT_MINUTES * 60 + v.cs;
}

/** 분은 초를 모두 더한 뒤 한 번만 반올림한다. budget은 출발부터 14:00까지 남은 분 */
export function lunchFits(mode: LunchMode, v: LunchInput, budget: number = LUNCH_MINUTES): boolean {
  return Math.round(lunchSeconds(mode, v) / 60) <= budget;
}

/** 이 가게·산책 장소 쌍이 이 방식으로 점심 코스가 될 수 있는지 (판정 전에 거르는 조건) */
export function lunchEligible(mode: LunchMode, place: Pick<Place, "category" | "preorder" | "keywords">, spot: Pick<WalkSpot, "picnic">): boolean {
  return mode === "dine" || (spot.picnic && isTakeoutPlace(place));
}

/** 서버가 TMAP으로 계산할 쌍을 고르는 기준: 가게 구간에 최소치를 넣어 두 방식 중 하나라도 들어오면 */
export function lunchPairNeeded(place: Pick<Place, "category" | "preorder" | "keywords">, spot: Pick<WalkSpot, "picnic" | "stay_minutes">, cp: number, cs: number): boolean {
  const ps = placeLegBounds(cp, cs).min;
  return LUNCH_MODES.some(({ key }) => lunchEligible(key, place, spot) && lunchFits(key, { cp, cs, ps, stay: spot.stay_minutes, preorder: place.preorder }));
}

/** 서울 시각의 자정 이후 분 (서버가 아니라 브라우저의 시계로 계산한다) */
export function seoulMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** 12:50 전이거나 14:00 뒤면 12:50 출발, 점심시간 중이면 지금. fromNow는 "지금 나가면" 기준인지 */
export function lunchStart(now?: Date): { minutes: number; fromNow: boolean } {
  const m = now ? seoulMinutes(now) : -1;
  return m >= LUNCH_START_MINUTES && m < LUNCH_END_MINUTES ? { minutes: m, fromNow: true } : { minutes: LUNCH_START_MINUTES, fromNow: false };
}

/** 자정 이후 분 → "13:38" */
export function clock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export type LunchCourse = {
  mode: LunchMode;
  place: Place;
  spot: WalkSpot;
  /** 캠퍼스 → 가게, 가게 → 장소, 장소 → 캠퍼스. 가게 구간이 어림값이면 rough */
  legs: { seconds: number; meters: number; rough: boolean }[];
  /** 출발부터 캠퍼스 도착까지 분 */
  totalMinutes: number;
  /** 출발 시각 (자정 이후 분) */
  startMinutes: number;
  /** "13:52" */
  returnAt: string;
  /** 포장해서 먹기에서 가게에서 기다리는 분 (먹고 걷기는 0) */
  waitMinutes: number;
  /** 산책 장소에서 보내는 분: 먹고 걷기는 둘러보기, 포장해서 먹기는 먹는 시간 */
  stayMinutes: number;
  rough: boolean;
};

/** 판정을 통과한 점심 코스만. 복귀 시각이 이른 순. placeLegs의 key는 placeLegKey */
export function lunchCourses(
  mode: LunchMode,
  places: Place[],
  spots: WalkSpot[],
  legs: Map<string, WalkLeg>,
  placeLegs: Map<string, PlaceLeg>,
  startAt?: Date,
): LunchCourse[] {
  // 먹고 걷기는 먹는 중일 수 있어 출발 시각을 알 수 없으므로 늘 12:50 기준이다. 포장해서 먹기만 지금 기준으로 다시 계산한다
  const start = mode === "takeout" ? lunchStart(startAt).minutes : LUNCH_START_MINUTES;
  const budget = LUNCH_END_MINUTES - start;
  const out: { seconds: number; course: LunchCourse }[] = [];
  for (const place of places) {
    // 가 볼 곳은 아직 검증되지 않아 추천하지 않는다
    if (place.walking_seconds == null || place.to_try) continue;
    const cp = place.walking_seconds;
    for (const spot of spots) {
      const campusLeg = legs.get(legKey(null, spot.id));
      if (!campusLeg || !lunchEligible(mode, place, spot)) continue;
      const cs = campusLeg.seconds;
      const stored = placeLegs.get(placeLegKey(place.id, spot.id));
      const { min, max } = placeLegBounds(cp, cs);
      // 저장된 TMAP 값이 없으면 최대치로 들어오는 쌍만 보여 주고, 시간은 어림값을 범위 안으로 잘라 쓴다
      const guess = estimateWalk(place, spot);
      const ps = stored ? stored.seconds : Math.min(max, Math.max(min, guess.seconds));
      const base = { cp, cs, stay: spot.stay_minutes, preorder: place.preorder };
      if (!lunchFits(mode, { ...base, ps: stored ? ps : max }, budget)) continue;
      const seconds = lunchSeconds(mode, { ...base, ps });
      const course: LunchCourse = {
        mode,
        place,
        spot,
        legs: [
          { seconds: cp, meters: place.walking_meters ?? 0, rough: place.walking_source !== "tmap" },
          { seconds: ps, meters: stored ? stored.meters : guess.meters, rough: !stored },
          { seconds: cs, meters: campusLeg.meters, rough: campusLeg.source !== "tmap" },
        ],
        totalMinutes: Math.round(seconds / 60),
        startMinutes: start,
        returnAt: clock(start + seconds / 60),
        waitMinutes: mode === "takeout" ? takeoutWaitMinutes(place.preorder) : 0,
        stayMinutes: mode === "takeout" ? PICNIC_EAT_MINUTES : spot.stay_minutes,
        rough: false,
      };
      course.rough = course.legs.some((l) => l.rough);
      out.push({ seconds, course });
    }
  }
  return out.sort((a, b) => a.seconds - b.seconds).map((x) => x.course);
}

export type LunchTimelineRow = { at: string; text: string };

/** 점심 코스 시간표. 각 시각은 출발부터 쌓은 초를 그때그때 반올림한다 (구간마다 반올림해 더하면 복귀 시각이 1분 어긋날 수 있다) */
export function lunchTimeline(c: LunchCourse): LunchTimelineRow[] {
  const [cp, ps, cs] = c.legs.map((l) => l.seconds);
  const at = (secondsFromStart: number) => clock(c.startMinutes + secondsFromStart / 60);
  if (c.mode === "dine") {
    const eaten = DINE_IN_MINUTES * 60;
    const arrive = eaten + ps;
    return [
      { at: clock(c.startMinutes), text: `캠퍼스 출발 → ${at(eaten)} 식사 끝` },
      { at: at(arrive), text: `${c.spot.name} 도착 · 둘러보기 ${c.stayMinutes}분` },
      { at: at(arrive + c.stayMinutes * 60), text: "출발" },
      { at: at(arrive + c.stayMinutes * 60 + cs), text: "캠퍼스 도착" },
    ];
  }
  const atPlace = cp;
  const leavePlace = atPlace + c.waitMinutes * 60;
  const atSpot = leavePlace + ps;
  const leaveSpot = atSpot + c.stayMinutes * 60;
  return [
    { at: clock(c.startMinutes), text: "캠퍼스 출발" },
    { at: at(atPlace), text: `${c.place.name} · ${c.place.preorder ? "미리 주문 받기" : "포장 기다리기"} ${c.waitMinutes}분` },
    { at: at(atSpot), text: `${c.spot.name} 도착 · 먹기 ${c.stayMinutes}분` },
    { at: at(leaveSpot), text: "출발" },
    { at: at(leaveSpot + cs), text: "캠퍼스 도착" },
  ];
}

// 랭킹. "이번 주"는 최근 7일 좋아요 × 2 + 꿀팁, "전체"는 좋아요 − 싫어요. 같으면 가까운 순.
// "할로윈"은 이벤트 기간에 꿀팁이 많이 달린(유령을 퇴치한) 가게 순.
export type RankingPeriod = "week" | "all" | "halloween";

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

/** 가 볼 곳은 줄 세우지 않는다 */
export function ranking(all: Place[], period: RankingPeriod): Ranking {
  const places = all.filter((p) => !p.to_try);
  const fellBack = period === "week" && places.every((p) => p.weekly_score === 0);
  const effective: RankingPeriod = fellBack ? "all" : period;
  const score =
    effective === "week" ? (p: Place) => p.weekly_score : effective === "halloween" ? (p: Place) => p.event_tips : (p: Place) => p.likes - p.dislikes;
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
  return { ...place, to_try: false, tip_count: place.tip_count + 1, weekly_score: place.weekly_score + weeklyScore(0, 1), event_tips: place.event_tips + 1 };
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

/**
 * 인스타그램 계정 입력을 아이디로 바꾼다. "@kisa_sikdang", "instagram.com/kisa_sikdang/", 프로필 주소를 모두 받는다.
 * 빈 입력은 "" (등록 지우기), 아이디 모양이 아니면 null.
 */
export function parseInstagramHandle(input: string): string | null {
  let v = input.trim();
  if (!v) return "";
  const url = v.match(/instagram\.com\/([^/?#]+)/i);
  if (url) v = url[1];
  v = v.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(v) ? v : null;
}

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
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
  // 할로윈 이벤트 연출. 고르기 버튼은 이벤트 기간에만 보이고, 기록 다시 보기는 계속 된다.
  { key: "cauldron", label: "🧙 마녀의 솥" },
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

// 길거리 제보 (GLOSSARY.md: 길거리 제보, 제보 종류, 노점, 노점 확인, docs/adr/0007)
export const STALL_KINDS = [
  { key: "bungeoppang", label: "붕어빵" },
  { key: "hotteok", label: "호떡" },
  { key: "goguma", label: "군고구마" },
  { key: "gunbam", label: "군밤" },
  { key: "eomuk", label: "어묵·떡볶이" },
  { key: "truck", label: "푸드트럭" },
  { key: "etc", label: "기타" },
] as const;
export type StallKind = (typeof STALL_KINDS)[number]["key"];
export const STALL_KIND_LABEL = Object.fromEntries(STALL_KINDS.map((k) => [k.key, k.label])) as Record<StallKind, string>;

export function isStallKind(v: unknown): v is StallKind {
  return STALL_KINDS.some((k) => k.key === v);
}

/** 노점 하나에 고를 수 있는 제보 종류 수. 처음 고른 것이 대표 종류다 */
export const MAX_STALL_KINDS = 3;

/** "군고구마 · 붕어빵" */
export function stallKindsLabel(kinds: readonly StallKind[]): string {
  return kinds.map((k) => STALL_KIND_LABEL[k]).join(" · ");
}
