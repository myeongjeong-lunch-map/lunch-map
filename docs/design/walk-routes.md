# 산책 코스 설계

점심을 먹고 캠퍼스 근처 공원이나 예술의전당을 한 바퀴 돌고 올 수 있게, 지도에 **산책 장소**와 **산책 코스**를 더한다.
코스마다 총 거리, 걷는 시간, 둘러보는 시간을 함께 보여 준다.

- 요청: "근처 공원이랑 예술의전당 등 산책 루트를 만들고, 코스를 짜 주도록, 예상 시간도 함께 보이도록."
- 상태: 설계 (2026-10-22). 구현은 다음 커밋.
- 구현자: 이 문서만 보고 따라갈 수 있게 썼다. 끝의 [사용자에게 확인할 질문](#사용자에게-확인할-질문)은 추천안대로 구현하고, 답이 다르면 그때 고친다.
- 관련 결정: [ADR 0001](../adr/0001-walking-time-daily-refresh.md)(도보 시간 매일 재계산), [ADR 0005](../adr/0005-walk-course-time-from-daily-legs.md)(코스 시간은 구간을 더해서 구한다)

## 한눈에

| 항목 | 결정 |
|---|---|
| 데이터 | 가게(`places`)와 **따로** 둔다. `walk_spots`, `walk_courses`, `walk_course_stops`, `walk_legs` 4개 테이블 |
| 코스 종류 | **추천 코스**(관리자가 등록)와 **내 코스**(사용자가 장소를 골라 즉석으로 짜는 것) 둘 다. 추천 코스가 먼저 |
| 예상 시간 | 장소 두 곳 사이(**구간**)마다 TMAP 보행 경로를 매일 한 번 계산해 저장하고, 코스 시간은 구간을 더한다. 화면을 볼 때 TMAP을 부르지 않는다 |
| 코스 모양 | 캠퍼스에서 출발해 산책 장소 1~5곳을 순서대로 들르고 캠퍼스로 돌아온다 |
| 코스 시간 | 걷는 시간(TMAP) + 둘러보는 시간(장소마다 정한 값). 둘을 나눠서도 보여 준다 |
| 화면 | 탭을 하나 더한다: 🏆 랭킹 · 📍 목록 · 💡 꿀팁 · 🎟️ 추첨 · **🚶 산책** |
| 점심시간 필터 | 넣는다. 추천 코스 목록에 "⏱ 30분 이내", "⏱ 45분 이내" 칩 |
| 관리 화면 | 1차에는 없다. 처음 장소·코스는 마이그레이션 SQL로 넣는다. 관리자 화면은 3단계 |

## 1. 용어

GLOSSARY.md에 아래를 더한다(구현 2단계에서). 기존 항목 중 **캠퍼스**, **도보 시간**은 뜻을 넓히지 않는다. 도보 시간은 여전히 "캠퍼스 → 가게"만 뜻하고, 산책에는 "걷는 시간"이라는 말을 따로 쓴다.

```markdown
**산책 장소 (Walk Spot)**:
점심 뒤에 걸어서 들를 만한 공원, 문화시설, 산책길 한 곳. 가게와 달리 평가·키워드·꿀팁·랭킹이 없고, 관리자만 추가한다.
지도에서는 장소의 대표 지점(입구나 광장) 하나로 찍힌다.
_Avoid_: 스팟, 명소, 관광지, 가게 (가게는 점심·카페만)

**산책 코스 (Walk Course)**:
캠퍼스에서 출발해 산책 장소 1~5곳을 정한 순서대로 들르고 캠퍼스로 돌아오는 길.
관리자가 미리 만들어 둔 **추천 코스**와, 사용자가 장소를 골라 그 자리에서 짜는 **내 코스**가 있다. 내 코스는 저장하지 않고 이 브라우저에만 남는다.
_Avoid_: 루트, 산책로, 트레킹, 경로 (경로는 지도 위의 선을 말할 때만)

**구간 (Leg)**:
산책 코스에서 이웃한 두 지점(캠퍼스 또는 산책 장소) 사이를 걷는 길 하나. 걷는 시간과 거리는 구간마다 TMAP 보행 경로로 매일 다시 계산한다.

**걷는 시간 (Walking Time of a Course)**:
산책 코스의 구간 시간을 모두 더한 값. 사람이 입력하지 않는다.

**둘러보는 시간 (Stay Time)**:
산책 장소에서 머무르는 예상 시간(분). 장소마다 기본값이 있고, 추천 코스는 장소별로 바꿔 둘 수 있다.
_Avoid_: 체류 시간, 관람 시간

**코스 시간 (Course Time)**:
걷는 시간 + 둘러보는 시간. 코스 카드에 크게 보이는 값이다.
_Avoid_: 소요 시간, 예상 시간 (화면 문구로만 사용)
```

## 2. 데이터

### 2-1. 가게 테이블과 따로 둔다

`places`에 카테고리 "산책"을 하나 더하는 방법도 생각했지만 따로 둔다.

- 가게의 거의 모든 기능이 산책 장소와 맞지 않는다: 평가·키워드·꿀팁·랭킹·🎲·팀 추첨통·카테고리 필터. 같은 테이블에 넣으면 이 모든 곳에 "산책 장소는 빼기" 조건을 붙여야 하고, 하나라도 빠뜨리면 랭킹이나 🎲에 공원이 나온다.
- `places`는 누구나 추가하는 테이블이다. 산책 장소는 코스 시간이 장소 수의 제곱으로 늘어나는 구간 계산과 묶여 있어서(아래 2-3) 관리자만 늘려야 한다.
- `places.category`의 check 제약과 `GLOSSARY.md`의 "가게 = 점심·카페" 정의를 깨지 않는다.

잃는 것: 산책 장소를 네이버 플레이스로 띄우는 기능은 따로 연결해야 한다. `naver_place_id` 칸을 같은 규칙으로 두고 `NaverPlacePanel`을 재사용한다(4-4).

### 2-2. 추천 코스와 내 코스

둘 다 만든다. 구간 표(2-3)를 쓰면 내 코스도 TMAP 호출이 0이라 추가 비용이 거의 없다.

| 단계 | 내용 | 이유 |
|---|---|---|
| 1차 | 추천 코스 보기 | 처음 쓰는 사람이 "어디를 걸으면 되지?"를 바로 해결한다. 데이터는 마이그레이션으로 넣는다 |
| 1차 | 내 코스 짜기 | 구간 표가 있으면 화면 작업만 남는다 |
| 3차 | 관리자 화면에서 장소·코스 추가·수정 | 장소가 자주 바뀌지 않아서 처음엔 SQL로 충분하다 |

내 코스는 서버에 저장하지 않는다. 이 브라우저의 `localStorage`에만 둔다(`lm_walk_draft`). 공유나 저장은 [질문 3](#사용자에게-확인할-질문).

### 2-3. 구간 표 (`walk_legs`)

코스 시간을 구하는 핵심이다. 지점은 캠퍼스와 산책 장소들이다. **두 지점의 모든 쌍**마다 TMAP 보행 경로를 한 번 구해 저장한다.

- 산책 장소가 N곳이면 구간은 N(캠퍼스 ↔ 장소) + N(N−1)/2(장소 ↔ 장소)개. 6곳이면 21개, 10곳이면 55개, 20곳이면 210개.
- 쌍은 방향 없이 한 번만 저장한다. A → B 경로를 B → A로 쓸 때는 좌표 순서를 뒤집는다. 걷는 길은 일방통행이 거의 없어서 시간 차이가 무시할 만하다.
- 저장 규칙: 캠퍼스 쪽 구간은 `spot_a = null`, 장소끼리는 `spot_a < spot_b`(uuid 비교). 경로 좌표는 `spot_a → spot_b`(캠퍼스 → 장소) 방향으로 저장한다.
- 코스 시간 = 캠퍼스 → 1번 → 2번 → … → 캠퍼스의 구간 시간 합 + 둘러보는 시간 합. 어떤 조합이든 표에서 바로 더할 수 있다.

### 2-4. 마이그레이션 초안

파일: `supabase/migrations/0007_walk_courses.sql`. (`0006_walking_path.sql`이 앞에 있으므로 다음 번호는 0007이다.)

```sql
-- 산책 장소·산책 코스 (GLOSSARY.md, docs/design/walk-routes.md, docs/adr/0005 참고)
-- 가게(places)와 따로 둔다: 평가·키워드·꿀팁·랭킹이 없고 관리자만 추가한다.
-- 모든 읽기/쓰기는 서버(service role)에서만 한다. RLS를 켜고 정책을 두지 않는다.

-- 1) 산책 장소: 지도에 찍히는 대표 지점(입구·광장) 하나
create table if not exists public.walk_spots (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 40),
  kind text not null check (kind in ('park', 'culture', 'trail')),  -- 공원, 문화시설, 산책길·다리
  summary text check (char_length(summary) <= 120),                 -- 카드에 한 줄로 보이는 소개
  lat double precision not null,
  lng double precision not null,
  stay_minutes smallint not null default 5 check (stay_minutes between 0 and 60),  -- 둘러보는 시간 기본값
  naver_place_id text check (naver_place_id ~ '^[0-9]{1,20}$'),
  created_at timestamptz not null default now()
);

-- 2) 추천 코스: 관리자가 만든다. 캠퍼스 → 장소들 → 캠퍼스
create table if not exists public.walk_courses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 40),
  summary text check (char_length(summary) <= 200),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.walk_course_stops (
  course_id uuid not null references public.walk_courses(id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  -- 코스에 들어간 장소는 지울 수 없다. 코스에서 먼저 뺀다.
  spot_id uuid not null references public.walk_spots(id) on delete restrict,
  stay_minutes smallint check (stay_minutes between 0 and 60),  -- null이면 장소 기본값
  primary key (course_id, position),
  unique (course_id, spot_id)
);

-- 3) 구간: 두 지점 사이의 TMAP 보행 경로. 쌍마다 한 줄, 방향 없음.
--    spot_a가 null이면 캠퍼스. 장소끼리는 spot_a < spot_b. path는 spot_a(캠퍼스) → spot_b 방향 [경도, 위도] 배열.
--    TMAP 약관(저장 후 24시간)에 따라 매일 다시 계산해 덮어쓴다 (docs/adr/0001, 0005).
create table if not exists public.walk_legs (
  spot_a uuid references public.walk_spots(id) on delete cascade,
  spot_b uuid not null references public.walk_spots(id) on delete cascade,
  seconds integer not null,
  meters integer not null,
  source text not null check (source in ('tmap', 'estimate')),
  path jsonb,
  updated_at timestamptz not null default now(),
  constraint walk_legs_pair unique nulls not distinct (spot_a, spot_b),
  constraint walk_legs_order check (spot_a is null or spot_a < spot_b)
);

alter table public.walk_spots enable row level security;
alter table public.walk_courses enable row level security;
alter table public.walk_course_stops enable row level security;
alter table public.walk_legs enable row level security;

grant select, insert, update, delete on public.walk_spots, public.walk_courses, public.walk_course_stops, public.walk_legs to service_role;

-- 4) 처음 장소와 추천 코스 (좌표는 5-1 참고. 구간은 배포 뒤 /api/cron/walk-legs를 한 번 돌려 채운다)
insert into public.walk_spots (name, kind, summary, lat, lng, stay_minutes) values
  ('예술의전당', 'culture', '오페라하우스 앞 광장과 음악분수. 한가람미술관·서예박물관도 여기', 37.4806452, 127.0135598, 10),
  ('국립국악원', 'culture', '예술의전당 옆 국악 공연장. 마당이 조용하다', 37.4775049, 127.0085657, 5),
  ('대성사', 'trail', '예술의전당 뒤 우면산 들머리의 절. 오르막이 있다', 37.4762002, 127.0134966, 5),
  ('서리풀공원', 'park', '서초3동 쪽 숲길. 방배·서초역 방향으로 길게 이어진다', 37.4882590, 127.0019812, 5),
  ('누에다리', 'trail', '서리풀공원과 몽마르뜨공원을 잇는 다리. 반포대로 전망', 37.4967289, 127.0052507, 3),
  ('몽마르뜨공원', 'park', '서래마을 위 잔디 공원', 37.4955415, 127.0038788, 10)
on conflict (name) do nothing;

insert into public.walk_courses (name, summary, sort_order) values
  ('예술의전당 한 바퀴', '밥 먹고 바로 다녀오는 가장 짧은 코스', 1),
  ('국악원 지나 예술의전당', '국립국악원 마당을 지나 예술의전당 광장까지', 2),
  ('서리풀공원 숲길', '나무 그늘 아래로 잠깐 걷고 오기', 3),
  ('누에다리 넘어 몽마르뜨공원', '여유 있는 날. 점심시간엔 빠듯하다', 4)
on conflict (name) do nothing;

insert into public.walk_course_stops (course_id, position, spot_id, stay_minutes)
select c.id, s.position, sp.id, s.stay_minutes
from (values
  ('예술의전당 한 바퀴', 1, '예술의전당', null::smallint),
  ('국악원 지나 예술의전당', 1, '국립국악원', null),
  ('국악원 지나 예술의전당', 2, '예술의전당', 5),
  ('서리풀공원 숲길', 1, '서리풀공원', null),
  ('누에다리 넘어 몽마르뜨공원', 1, '서리풀공원', 0),
  ('누에다리 넘어 몽마르뜨공원', 2, '누에다리', null),
  ('누에다리 넘어 몽마르뜨공원', 3, '몽마르뜨공원', null)
) as s(course, position, spot, stay_minutes)
join public.walk_courses c on c.name = s.course
join public.walk_spots sp on sp.name = s.spot
on conflict do nothing;
```

메모:

- `unique nulls not distinct`는 Postgres 15 이상에서 된다(Supabase는 15+). 덕분에 캠퍼스 구간(`spot_a = null`)도 `upsert(..., { onConflict: "spot_a,spot_b" })`로 덮어쓸 수 있다. 만약 PostgREST upsert가 이 제약을 못 찾으면, 크론에서 `delete().not("spot_b", "is", null)` 후 전체 `insert`로 바꾼다(하루 한 번이라 잠깐 비어도 화면은 추정값으로 버틴다 — 4-2).
- 마이그레이션은 Supabase SQL 편집기에서 사람이 실행한다. 구현 세션은 파일만 만든다.

## 3. 예상 시간

### 3-1. 구간마다 TMAP 한 번, 코스는 더하기

`src/lib/server/walking.ts`의 `computeWalking(lat, lng)`은 출발점이 `CAMPUS`로 고정돼 있다. 출발점을 받도록 일반화한다.

```ts
export type LatLng = { lat: number; lng: number };
/** from → to 보행 경로. TMAP이 실패하면 직선거리 × 1.3 추정값 */
export async function computeRoute(from: LatLng, to: LatLng): Promise<Walking>;
export function estimateRoute(from: LatLng, to: LatLng): Walking;
// 기존 함수는 그대로 둔다 (가게 추가·크론이 쓴다)
export const computeWalking = (lat: number, lng: number) => computeRoute(CAMPUS, { lat, lng });
export const estimateWalking = (lat: number, lng: number) => estimateRoute(CAMPUS, { lat, lng });
```

요청 본문의 `startName`/`endName`은 TMAP이 필수로 받는 값이라 `"start"`/`"end"`로 둔다. 응답 해석(`totalTime`, `totalDistance`, `tmapPath`)은 지금 코드를 그대로 쓴다.

**TMAP 경유지(`passList`)는 쓰지 않는다.** 보행자 경로는 경유지를 최대 5곳 받는다([TMAP 보행자 경로안내 문서](https://tmap-skopenapi.readme.io/reference/%EB%B3%B4%ED%96%89%EC%9E%90-%EA%B2%BD%EB%A1%9C%EC%95%88%EB%82%B4))(캠퍼스 → 5곳 → 캠퍼스와 마침 맞는다). 하지만 코스 하나에 한 번씩 부르는 방식이라 내 코스는 화면에서 조합이 바뀔 때마다 TMAP을 불러야 하고, 이는 ADR 0001이 기각한 "조회할 때 계산"이다. 구간 표는 조합과 상관없이 호출 수가 장소 수로만 정해진다. 자세한 비교는 ADR 0005.

### 3-2. 매일 재계산 (ADR 0001과의 관계)

구간 값도 TMAP에서 받은 데이터라 ADR 0001의 24시간 규칙을 그대로 따른다.

- 새 예약 작업 `GET /api/cron/walk-legs`: 모든 구간을 다시 계산해 덮어쓴다. 가게 크론(`/api/cron/walking`)과 **따로** 둔다. 가게 크론은 가게 수만큼 순서대로 TMAP을 불러서 이미 수십 초 걸릴 수 있고, 함수 시간 제한을 둘이 나눠 쓰지 않게 하려는 것이다.
- `vercel.json`의 `crons`에 `{ "path": "/api/cron/walk-legs", "schedule": "30 19 * * *" }`를 더한다(한국 시간 새벽 4시 30분, 가게 크론 30분 뒤).
- 인증은 가게 크론과 같다: `Authorization: Bearer $CRON_SECRET`.
- 계산 순서: 장소 목록을 읽고 → 캠퍼스 ↔ 각 장소, 장소 쌍(`a.id < b.id`) 모두에 대해 `computeRoute`를 **하나씩 순서대로** 부르고(TMAP 초당 호출 제한을 모르므로 병렬로 부르지 않는다) → `walk_legs`에 upsert. 응답은 `{ updated, tmap, estimate }`.
- 장소를 지우면 구간은 `on delete cascade`로 같이 지워진다. 크론이 끝난 뒤 표에 없는 쌍이 남을 일은 없다.
- 크론이 멈추면 경로 좌표는 24시간 뒤 안 보이고(직선 점선으로 대신, 가게와 같은 규칙) 시간 값은 계속 보인다. 지금 가게의 `walking_seconds`도 기간 검사 없이 보여 주므로 맞춘다.

### 3-3. 둘러보는 시간을 더한다

코스 시간에는 둘러보는 시간을 더한다. "예술의전당 한 바퀴"를 걷는 시간만으로 20분이라고 하면, 실제로 광장에서 10분 쉬다 오는 사람에게는 틀린 숫자가 된다.

- 장소마다 기본값 `walk_spots.stay_minutes`. 추천 코스는 `walk_course_stops.stay_minutes`로 바꿀 수 있다(지나가기만 하는 장소는 0).
- 내 코스는 장소 기본값을 쓴다. 사용자가 바꾸게 하지는 않는다(1차).
- 화면에는 합계와 함께 나눠서 보인다: **약 30분** · 걷기 20분 + 둘러보기 10분 · 1.3km.

### 3-4. 계산 규칙 (`src/lib/domain.ts`)

클라이언트와 서버가 같은 함수를 쓴다.

```ts
export const MAX_COURSE_STOPS = 5;
export const WALK_SPOT_KINDS = [
  { key: "park", label: "공원", emoji: "🌳" },
  { key: "culture", label: "문화시설", emoji: "🎭" },
  { key: "trail", label: "산책길", emoji: "🌉" },
] as const;
export type WalkSpotKind = (typeof WALK_SPOT_KINDS)[number]["key"];

export type WalkSpot = {
  id: string; name: string; kind: WalkSpotKind; summary: string | null;
  lat: number; lng: number; stay_minutes: number; naver_place_id: string | null;
};
export type WalkCourseStop = { spot_id: string; stay_minutes: number | null };
export type WalkCourse = { id: string; name: string; summary: string | null; stops: WalkCourseStop[] };
/** a가 null이면 캠퍼스. 방향 없음 */
export type WalkLeg = { a: string | null; b: string; seconds: number; meters: number; source: "tmap" | "estimate" };

/** 구간 찾기 키. null(캠퍼스)은 "campus" */
export function legKey(x: string | null, y: string | null): string;

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
export function courseTime(stops: WalkCourseStop[], spots: Map<string, WalkSpot>, legs: Map<string, WalkLeg>): CourseTime;
```

`courseTime` 규칙:

- 이웃한 지점 쌍마다 `legs.get(legKey(...))`. 없으면(장소를 막 추가해서 크론 전) 그 구간은 직선거리 × 1.3, 시속 4km로 어림잡고 `source: "missing"`. 이 계산을 위해 `haversine`을 `walking.ts`에서 `domain.ts`로 옮겨 export한다(`walking.ts`는 `server-only`라 클라이언트에서 못 쓴다).
- `stayMinutes`는 `stop.stay_minutes ?? spot.stay_minutes`의 합.
- `totalMinutes = Math.round(walkSeconds / 60) + stayMinutes`.

## 4. 화면

### 4-1. 탭

`🏆 랭킹 · 📍 목록 · 💡 꿀팁 · 🎟️ 추첨 · 🚶 산책`. 탭 줄을 `grid-cols-4`에서 `grid-cols-5`로 바꾼다. 375px 폭에서 칸 하나가 약 65px라 글자를 `text-xs`로 줄여 "🚶 산책"이 한 줄에 들어가게 한다.

산책 탭에서는:

- 🎲 버튼 자리에 **내 코스 줄**을 보인다(아래 4-3). 🎲는 가게용이라 산책 탭에서는 숨긴다.
- 지도에는 가게 마커를 숨기고 **산책 장소 마커만** 보인다(`mapPlaces = []`). 다른 탭에서는 산책 장소 마커를 숨긴다.
- 탭에 들어오면 지도를 캠퍼스와 모든 산책 장소가 보이게 맞춘다(`fitBounds`, 모바일은 시트 높이만큼 아래 여백).
- 추첨 탭의 팀 추첨통에는 가게만 넣는다. 산책 장소는 넣지 않는다.

### 4-2. 산책 탭 내용 (`WalkPanel`)

위에서 아래로:

1. **필터 칩**: `⏱ 30분 이내`, `⏱ 45분 이내` (코스 시간 기준, 하나만 고르고 다시 누르면 해제). 기존 `PlaceList`의 `Chip` 모양을 그대로 쓴다(`Chip`을 export하거나 같은 클래스로 만든다).
2. **추천 코스 카드** 목록(`sort_order` 순). 카드 한 장:
   ```
   예술의전당 한 바퀴                           약 30분
   🏫 → 🎭 예술의전당 → 🏫                 걷기 20분 + 둘러보기 10분 · 1.3km
   밥 먹고 바로 다녀오는 가장 짧은 코스
   ```
   - 오른쪽 위 큰 숫자가 코스 시간. 45분을 넘으면 그 옆에 회색 글씨로 "점심시간엔 빠듯".
   - 시간 표시는 늘 "약 N분". `rough`이면 카드 아래에 작게 "일부 구간은 어림값이에요"를 더한다.
   - 누르면 코스 보기(4-4).
3. **직접 짜기** 제목 + 안내 "지도나 아래 목록에서 장소를 골라 내 코스를 만들어요 (최대 5곳)".
4. **산책 장소 목록**: 종류 이모지, 이름, 한 줄 소개, "캠퍼스에서 걸어서 N분"(캠퍼스 구간), 오른쪽 ＋/✓ 버튼(내 코스에 담기/빼기). 이름을 누르면 장소 보기(4-5).

필터는 추천 코스에만 걸린다. 장소 목록은 항상 다 보인다.

### 4-3. 내 코스 줄 (헤더, 🎲 자리)

모바일 시트가 가장 낮을 때(peek, 180px)에도 보이도록 헤더에 둔다.

- 비었으면: 회색 안내 "🚶 장소를 골라 내 코스를 짜 보세요".
- 담았으면: `내 코스 3곳 · 약 38분` + `[보기]` + `[비우기]`. 숫자는 `courseTime`으로 바로 계산한다(서버 요청 없음).
- `[보기]`를 누르면 내 코스 보기(4-4).

### 4-4. 코스 보기 (`CourseDetail`)

추천 코스와 내 코스가 같은 컴포넌트를 쓴다.

```
← 산책으로
예술의전당 한 바퀴
약 30분 · 걷기 20분 + 둘러보기 10분 · 1.3km

🏫 캠퍼스 출발
 │ 걸어서 10분 · 640m
① 🎭 예술의전당          둘러보기 10분   [네이버 지도]
 │ 걸어서 10분 · 640m
🏫 캠퍼스 도착

일부 구간은 어림값이에요 (rough일 때만)
```

- 내 코스일 때만 각 장소 오른쪽에 `↑` `↓` `✕` 버튼(순서 바꾸기, 빼기). 추천 코스에는 `[이 코스로 내 코스 만들기]` 버튼을 두어 내 코스에 복사한다(그 뒤 고칠 수 있다).
- `[네이버 지도]`는 장소에 `naver_place_id`가 있으면 `NaverPlacePanel`을 띄우고, 없으면 `naverMapUrl`처럼 이름 검색을 새 창으로 연다. 1차에서는 `naverMapUrl({ name, road_address: "서울 서초구", naver_place_id })`를 새 창으로 여는 것으로 충분하다.
- **지도**: 캠퍼스 → 장소들 → 캠퍼스 경로를 지금 가게 경로와 같은 초록 선·같은 그리기 애니메이션으로 그린다. 장소 마커에는 순서 번호(①②③)를 단다. 지도는 경로 전체가 보이게 맞춘다. 경로 위 칩에는 `1.3km · 약 30분`.
- 경로 좌표는 `GET /api/walk/path?stops=…`로 받는다. 받은 구간 중 하나라도 `path: null`이면 그 구간은 두 점을 잇는 직선으로 채우고, 선 전체를 점선(`shortdash`)으로 그린다. 가게 경로의 "저장된 경로가 없으면 점선" 규칙과 같다.
- 모바일: 코스를 열면 시트를 `half`로 둔다(지금 `select`가 하는 것과 같다). 지도 아래 여백(`bottomInset`)도 그대로 쓴다.

### 4-5. 장소 보기 (`SpotDetail`)

지도에서 산책 장소 마커를 누르거나 목록에서 이름을 누르면 연다. 이름, 종류, 한 줄 소개, 둘러보는 시간, 캠퍼스에서 걸어서 N분, `[내 코스에 담기/빼기]`, `[네이버 지도]`. 지도에는 캠퍼스 → 장소 경로를 가게처럼 그린다(캠퍼스 구간 경로 하나를 받아 그림 = `GET /api/walk/path?stops=<id>`의 첫 구간).

### 4-6. 점심시간 필터는 유용한가

유용하다고 본다. 이 기능을 여는 사람의 첫 질문이 "지금 다녀올 수 있나?"이고, 추천 코스가 30분부터 80분까지 차이가 크다. 다만 점심시간 1시간에는 밥 먹는 시간이 들어가므로 "60분 이내"는 의미가 없다. 그래서 30분·45분 두 칩만 둔다. 기준값은 [질문 2](#사용자에게-확인할-질문).

### 4-7. 상태 (`src/components/LunchMap.tsx`)

화면 상태는 `LunchMap`의 React state에 둔다(라이브러리를 더하지 않는다). 서버 데이터는 가게처럼 `useEffect`에서 `api.walk()`로 한 번 불러와 state에 담는다.

```ts
type Tab = "rank" | "list" | "tips" | "draw" | "walk";
type Mode =
  | { kind: "browse" }
  | { kind: "detail"; id: string; tab?: PlaceTab }
  | { kind: "add" }
  | { kind: "spot"; id: string }
  /** courseId가 null이면 내 코스 */
  | { kind: "course"; courseId: string | null };

// LunchMap에 더할 state
walk: { spots; courses; legs } | null;  // GET /api/walk
walkDraft: string[];                    // 내 코스 장소 id (순서대로). lm_walk_draft에 저장
walkMaxMinutes: 30 | 45 | null;         // 추천 코스 필터
```

- 담기·빼기·순서 바꾸기·비우기는 `walkDraft`를 고치는 작은 함수들이고, 고칠 때마다 `saveWalkDraft`로 저장한다. 5곳이 차 있으면 더 담지 않고 ＋ 버튼을 비활성으로 두며 "내 코스는 5곳까지 담을 수 있어요"를 보인다.
- `lm_walk_draft` 읽기·쓰기는 `api.ts`에 `loadWalkDraft`/`saveWalkDraft`로 둔다(`loadNickname`/`saveTeamId`와 같은 모양). 마운트 뒤에 불러온다(서버 렌더와 어긋나지 않게).
- 코스·장소 보기에서 그릴 경로는 `api.walkPath(ids)`를 effect에서 불러 state에 담는다. 늦게 온 응답이 지금 보는 코스를 덮지 않게 요청마다 취소 표시를 둔다.
- 코스·장소를 열 때 시트가 `peek`이면 `half`로 올린다(`select`와 같다). "← 산책으로"는 `{ kind: "browse" }`로 돌아간다. 탭은 `walk`로 남아 있다.
- 지운 장소가 내 코스에 남아 있으면 화면에서 걸러 낸다.
- `select(null)`(지도 빈 곳 누름)은 `spot`/`course` 모드에서도 `browse`로 돌아간다.

## 5. 처음 데이터

### 5-1. 산책 장소 후보

좌표는 OpenStreetMap(Nominatim) 검색 결과다. 캠퍼스 좌표(37.4845457, 127.0108578)는 같은 방식으로 찾은 "반포대로 45"와 소수점 넷째 자리까지 같아서 기준이 맞다. 넣기 전에 관리자가 네이버 지도에서 **입구나 광장 위치로** 한 번 확인한다([질문 5](#사용자에게-확인할-질문)). 공원은 면적이 넓어서 중심점을 찍으면 TMAP이 엉뚱한 쪽 입구로 길을 낼 수 있다.

| 이름 | 종류 | 위도 | 경도 | 캠퍼스에서 (어림) | 둘러보기 | 비고 |
|---|---|---|---|---|---|---|
| 예술의전당 | 문화시설 | 37.4806452 | 127.0135598 | 640m · 10분 | 10분 | 오페라하우스 앞. 한가람미술관(37.4802407, 127.0144397)은 바로 옆이라 따로 두지 않는다 |
| 국립국악원 | 문화시설 | 37.4775049 | 127.0085657 | 1.05km · 16분 | 5분 | 예술의전당 서쪽 |
| 대성사 | 산책길 | 37.4762002 | 127.0134966 | 1.24km · 19분 | 5분 | 예술의전당 뒤 우면산 들머리, 서울둘레길 위. 오르막 |
| 서리풀공원 | 공원 | 37.4882590 | 127.0019812 | 1.15km · 17분 | 5분 | OSM의 서초3동 쪽 공원 지점. 입구 좌표로 바꿀 것 |
| 누에다리 | 산책길 | 37.4967289 | 127.0052507 | 1.88km · 28분 | 3분 | 서리풀공원 ↔ 몽마르뜨공원 다리 |
| 몽마르뜨공원 | 공원 | 37.4955415 | 127.0038788 | 1.78km · 27분 | 10분 | 서초역·고속터미널에서 걸어서 9분 거리 |

"어림"은 지금 코드의 추정 공식(직선거리 × 1.3, 시속 4km)으로 계산한 값이다. 실제 값은 배포 뒤 구간 크론이 TMAP으로 채운다.

장소 6곳이면 구간은 6 + 15 = **21개**다.

### 5-2. 추천 코스 초안

| 코스 | 순서 | 거리 (어림) | 걷기 | 둘러보기 | 코스 시간 |
|---|---|---|---|---|---|
| 예술의전당 한 바퀴 | 캠퍼스 → 예술의전당 → 캠퍼스 | 1.3km | 20분 | 10분 | **약 30분** |
| 국악원 지나 예술의전당 | 캠퍼스 → 국립국악원 → 예술의전당(5분) → 캠퍼스 | 2.4km | 37분 | 10분 | **약 47분** |
| 서리풀공원 숲길 | 캠퍼스 → 서리풀공원 → 캠퍼스 | 2.3km | 34분 | 5분 | **약 39분** |
| 누에다리 넘어 몽마르뜨공원 | 캠퍼스 → 서리풀공원(0분) → 누에다리 → 몽마르뜨공원 → 캠퍼스 | 4.4km | 67분 | 13분 | **약 80분** (점심시간엔 빠듯) |

앞의 셋이 요청의 "2~3개"이고, 넷째는 "몽마르뜨공원" 요청을 담으려고 넣은 긴 코스다. 점심시간에는 무리라 카드에 "점심시간엔 빠듯"이 붙는다. 빼고 싶으면 [질문 4](#사용자에게-확인할-질문).

## 6. API

모두 로그인 없이 읽는다. 쓰기는 관리자만(3단계).

| 메서드·경로 | 응답 | 비고 |
|---|---|---|
| `GET /api/walk` | `{ spots: WalkSpot[]; courses: WalkCourse[]; legs: WalkLeg[] }` | 경로 좌표는 빼고 보낸다(가게 목록에서 `walking_path`를 빼는 것과 같은 이유). 장소 20곳이어도 구간 210줄 × 숫자 몇 개라 작다 |
| `GET /api/walk/path?stops=<id>,<id>,…` | `{ legs: { path: [number, number][] \| null }[] }` | `stops.length + 1`개, 코스 순서대로, 걷는 방향으로 뒤집어서. 구간이 없거나 `updated_at`이 24시간 넘었으면 `path: null` |
| `GET /api/cron/walk-legs` | `{ updated, tmap, estimate }` | 3-2 |

- `GET /api/walk`: `walk_spots`, `walk_courses`(+ `walk_course_stops`를 `position` 순으로), `walk_legs`(`spot_a, spot_b, seconds, meters, source`)를 `Promise.all`로 읽는다. 행을 `WalkCourse.stops`, `WalkLeg { a, b }` 모양으로 바꾼다.
- `GET /api/walk/path`: `stops`는 라우트 안에서 손으로 검사한다(`teams` 라우트와 같은 방식) — 쉼표로 나눈 uuid 1~5개, 중복 없음. 틀리면 400. 없는 장소 id가 섞이면 404 "산책 장소를 찾을 수 없어요.". 필요한 구간만 `or(...)` 조건 하나로 읽는다. 구간 경로를 뒤집어야 하는 경우: 걷는 방향이 저장 방향(`spot_a → spot_b`, 캠퍼스 → 장소)과 반대일 때.
- 에러 처리는 다른 라우트처럼 `try { … } catch (e) { return errorResponse(e); }`.
- 라우트의 `ctx` 타입은 지금처럼 `RouteContext<"/api/…">`(Next 16 typegen)를 쓴다. 코드 쓰기 전에 `node_modules/next/dist/docs/`에서 Route Handler 문서를 확인한다(AGENTS.md).

## 7. TMAP 호출량과 비용

| 항목 | 하루 호출 |
|---|---|
| 가게 크론 (지금) | 가게 수 (노션에서 옮긴 21곳 + 추가분) |
| 가게 추가 | 추가 1건당 1 |
| 구간 크론 (새로) | N + N(N−1)/2. 6곳 21, 10곳 55, 20곳 210 |
| 내 코스·코스 보기 | **0** (저장된 값만 읽는다) |

- ADR 0001이 적은 무료 한도는 하루 1,000건이다. 이번에 TMAP 요금 페이지에서 다시 확인하지는 못했다(페이지가 로그인 뒤에 보인다). 구현 전에 SK open API 콘솔의 "API 사용 요금"에서 지금 요금제의 보행자 경로 한도를 확인한다([질문 6](#사용자에게-확인할-질문)).
- 장소는 **20곳까지만** 받는다(3단계 관리자 API에서 막는다). 그러면 구간 크론은 많아야 210건이라, 가게가 700곳을 넘기 전까지 한도 안이다.
- Vercel Hobby의 함수 실행 시간 제한 안에 구간 21~55개를 순서대로 부르는 것은 충분하다(한 건 수백 ms). 장소가 20곳에 가까워지면 크론 응답 시간을 보고 나눠 돌릴지 정한다.

## 8. 구현 단계

**시작 조건**: 가게 보행 경로선(`0006_walking_path.sql`, `/api/places/[id]/path`, `walking.ts`의 경로 좌표)이 먼저 들어가 있어야 한다. 이 설계는 `api.ts`와 `LunchMap.tsx`의 기존 state·fetch 방식 위에 얹는다.

**매 단계 검증**(레포에 있는 명령만. 테스트 스위트는 없다):

```bash
npm run typecheck   # next typegen && tsc --noEmit
npm run lint
npm run build
```

`npx tsc --noEmit`만 따로 돌리면 라우트 타입(`RouteContext`)이 없어서 실패할 수 있으니 `npm run typecheck`를 쓴다.

병렬 표시: **[A]** 1~2단계가 끝난 뒤 서로 다른 파일만 건드려서 동시에 진행할 수 있는 묶음. 같은 글자끼리는 한 사람이 순서대로.

### 1단계 — 마이그레이션 (먼저)

- [ ] `supabase/migrations/0007_walk_courses.sql`: 2-4의 SQL 그대로.
- 검증: 파일만 만든다. 운영 DB 적용은 사용자가 Supabase SQL 편집기에서 한다. 로컬 확인용 Supabase 프로젝트가 있으면 거기서 실행해 에러가 없는지, `select count(*) from walk_course_stops`가 7인지 본다.

### 2단계 — 용어와 도메인 (먼저)

- [ ] `GLOSSARY.md`: 1장의 항목을 "관리자" 앞에 더한다.
- [ ] `src/lib/domain.ts`: 3-4의 상수·타입·`legKey`·`courseTime`, `walkMinutesFromSeconds` 같은 표시 도우미가 필요하면 여기. `haversine`을 `walking.ts`에서 옮겨 export.
- [ ] `src/lib/server/walking.ts`: `computeRoute`/`estimateRoute`로 일반화, `haversine`은 `domain.ts`에서 import. 기존 `computeWalking`/`estimateWalking` 이름과 동작 유지.
- 검증: `npm run typecheck && npm run lint`. 가게 추가(`POST /api/places`)와 가게 크론이 그대로 컴파일되는지.

### 3단계 — 서버 **[A-서버]**

- [ ] `src/app/api/walk/route.ts`: `GET` (6장).
- [ ] `src/app/api/walk/path/route.ts`: `GET` (6장). `stops` 검사는 이 파일 안에서.
- [ ] `src/app/api/cron/walk-legs/route.ts`: `GET` (3-2). 기존 `src/app/api/cron/walking/route.ts`와 같은 모양.
- [ ] `vercel.json`: 크론 한 줄 추가.
- 검증:
  ```bash
  npm run typecheck && npm run lint && npm run build
  ```
  마이그레이션이 적용된 DB와 `.env.local`이 있으면 개발 서버(preview_start)로 확인:
  ```bash
  curl -s localhost:3000/api/walk | head -c 600
  ```
  ```bash
  curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/walk-legs
  ```
  (크론은 실제 TMAP을 21번 부른다. `{"updated":21,…}`이면 성공.) 그다음 `GET /api/walk/path?stops=<예술의전당 id>`가 `legs` 2개, 두 번째 경로의 첫 좌표가 예술의전당 근처인지 본다(뒤집기 확인).

### 4단계 — 클라이언트 데이터 **[A-화면]**

- [ ] `src/lib/api.ts`: `api.walk()`, `api.walkPath(stopIds)`, `loadWalkDraft`/`saveWalkDraft`(`lm_walk_draft`). 응답 타입 `WalkResponse`. 상태는 4-7대로 `LunchMap.tsx`에서.
- 검증: `npm run typecheck && npm run lint`.

### 5단계 — 화면 **[A-화면]** (4단계 뒤)

5-1과 5-2는 다른 파일이라 나눠서 동시에 할 수 있다(**[B]**). 5-3은 둘 다 끝난 뒤.

- [ ] 5-1 **[B-지도]** `src/components/NaverMap.tsx`, `src/app/globals.css`
  - 새 props: `spots: WalkSpot[]`, `selectedSpotId: string | null`, `onSelectSpot(id)`, `route: { stops: { lat: number; lng: number }[]; path: [number, number][] | null; chip: string | null } | null`(코스·장소 보기에서 그릴 경로. `stops`에 캠퍼스는 넣지 않는다).
  - 산책 장소 마커: `lm-marker spot` 클래스(종류 이모지 + 이름). 코스 안의 장소는 이모지 자리에 순서 번호. CSS는 `.lm-marker.campus`처럼 `.lm-marker.spot`을 더한다(테두리 `var(--brand)`, 배경 `var(--background)`).
  - 지금의 "선택한 가게 경로" 그리기(`slicePath`, `cumulative`, 애니메이션, 칩)를 `drawRoute(m, path, { dashed, chip })` 같은 함수로 빼서 가게 경로와 산책 경로가 같이 쓴다. 가게 경로 동작은 바뀌면 안 된다.
  - `route`가 있으면 그 경로 전체가 보이게 `fitBounds`, `route`가 없고 `spots`가 있으면 캠퍼스 + 장소 전체로 맞춘다.
- [ ] 5-2 **[B-패널]** `src/components/WalkPanel.tsx`, `src/components/CourseDetail.tsx`, `src/components/SpotDetail.tsx`
  - 4-2, 4-4, 4-5대로. 화면 문구는 1장 용어("산책 장소", "코스 시간", "둘러보기")를 따른다.
  - 숫자는 모두 `courseTime`으로. 컴포넌트 안에서 시간을 따로 계산하지 않는다.
- [ ] 5-3 `src/components/LunchMap.tsx`
  - `TAB_LABEL`에 `walk: "🚶 산책"`, 탭 줄 `grid-cols-5`.
  - 산책 탭일 때 🎲 대신 내 코스 줄(4-3), 본문에 `WalkPanel`/`CourseDetail`/`SpotDetail`.
  - `NaverMap`에 `places={tab === "walk" ? [] : mapPlaces}`, `spots={tab === "walk" ? spots : []}`, 코스·장소 보기일 때 `route`(=`useWalkPath` 결과를 이어 붙인 경로). 구간 경로 잇기: 각 구간 경로가 있으면 그대로, 없으면 두 점 직선, 하나라도 없으면 `dashed`.
  - `backLabel`이 `TAB_LABEL[tab].split(" ")[1]`로 만들어지므로(이모지 길이에 기대지 않는다) "산책으로"가 자연스럽게 나온다.
  - 마운트 뒤 `loadWalkDraft()`로 내 코스를 불러온다.
- 검증:
  ```bash
  npm run typecheck && npm run lint && npm run build
  ```
  개발 서버로 화면 확인(브라우저 미리보기):
  1. 🚶 산책 탭: 추천 코스 4장, 산책 장소 6곳, 지도에 가게 마커 없이 장소 마커만.
  2. "예술의전당 한 바퀴" 카드 → 지도에 초록 경로가 캠퍼스로 돌아오는 고리 모양, 카드와 같은 시간.
  3. 장소 3곳 담기 → 헤더 내 코스 줄 숫자가 바뀜 → 보기 → ↑↓로 순서 바꾸면 시간·경로가 바뀜. 새로 고침해도 내 코스가 남음.
  4. ⏱ 30분 이내 → 30분 넘는 코스가 빠짐.
  5. 375×812(모바일)에서 탭 5칸이 한 줄, 시트 peek에서 내 코스 줄이 보임, 코스를 열면 시트가 half이고 경로가 시트에 가리지 않음. 다크 모드에서 장소 마커가 보임.
  6. 다른 탭으로 돌아가면 가게 마커가 돌아오고 장소 마커가 사라짐. 가게 경로 그리기가 전과 같음.

### 6단계 — README (5단계와 함께)

- [ ] `README.md`: 첫 기능 목록에 "🚶 산책 — 근처 공원·예술의전당 추천 코스와 내 코스, 코스 시간", 구조의 `api/`에 `walk/`, `cron/walk-legs/`. ADR 표 설명에 산책 코스 시간.
- [ ] `docs/adr/0005-walk-course-time-from-daily-legs.md`: 초안을 확정본으로(제목 줄 위의 "초안" 표시 삭제).

### 7단계 — 관리자 화면 (나중, 별도 PR)

- [ ] `src/app/api/admin/walk/spots/route.ts`(POST), `…/spots/[id]/route.ts`(PATCH, DELETE): `requireAdmin`. 장소가 20곳이면 추가를 막는다. 추가하거나 좌표를 바꾸면 그 장소의 구간(캠퍼스 + 다른 장소 전부, N개)을 바로 계산해 upsert한다. 코스에 들어 있는 장소를 지우면 409 "코스에서 먼저 빼 주세요.".
- [ ] `src/app/api/admin/walk/courses/…`: 코스 추가·수정·삭제, 장소 순서(1~5곳).
- [ ] `src/components/AdminPanel.tsx`에 산책 섹션. 장소 위치는 가게 추가의 지도 핀 꽂기(`pickMode`)를 재사용할 수 있는지 먼저 본다.

## 9. 하지 않는 것 (1차)

- 산책 장소에 평가·키워드·꿀팁. 필요해지면 그때 가게 기능을 일반화할지 따로 정한다.
- 산책 코스에 가게(카페 등)를 끼워 넣기 — [질문 1](#사용자에게-확인할-질문).
- 내 코스 저장·공유, 팀 코스.
- 날씨, 일몰 시간, 공연 일정.
- 걷는 속도 설정(TMAP 값을 그대로 쓴다).

## 사용자에게 확인할 질문

추천안대로 설계했다. 답이 다르면 해당 장을 고친다.

1. **코스에 카페(가게)도 넣을 수 있게 할까요?** "예술의전당 갔다가 카페에서 테이크아웃" 같은 코스가 자연스럽습니다.
   - 추천: **1차는 산책 장소만.** 가게를 넣으면 구간 표가 가게 수만큼 커져서(가게 50곳이면 구간 수천 개) TMAP 한도를 넘습니다. 넣는다면 "코스 끝에 가게 하나"처럼 좁혀서 그때만 TMAP을 부르는 방식을 따로 설계해야 합니다.
2. **점심시간 필터 기준을 몇 분으로 할까요?**
   - 추천: **30분 · 45분 두 칩.** 점심 1시간 중 밥 먹는 데 20~30분이 들기 때문입니다. 실제로 산책하는 분들의 남는 시간이 다르면 숫자만 바꾸면 됩니다.
3. **내 코스를 저장하거나 팀원에게 링크로 보낼 수 있어야 할까요?**
   - 추천: **1차는 브라우저에만.** 링크 공유(`?course=id1,id2`)는 서버 저장 없이도 붙일 수 있어 2차로 쉽게 더할 수 있습니다.
4. **긴 코스("누에다리 넘어 몽마르뜨공원", 약 80분)를 넣을까요?** 요청에 몽마르뜨공원이 있었지만 점심시간 안에는 다녀오기 어렵습니다.
   - 추천: **넣되 "점심시간엔 빠듯" 표시.** 퇴근 뒤나 여유 있는 날 쓰도록. 빼고 싶으면 SQL의 그 코스 줄만 지웁니다.
5. **산책 장소 좌표 확인을 누가 할까요?** 공원은 넓어서 입구 위치를 찍어야 경로가 맞습니다(특히 서리풀공원).
   - 추천: **관리자(또는 사용자)가 마이그레이션 적용 전에 네이버 지도에서 6곳 좌표를 확인**하고 SQL의 숫자를 고칩니다. 구현 세션은 웹에서 찾은 값을 그대로 넣습니다.
6. **TMAP 요금제의 보행자 경로 하루 한도를 확인해 주실 수 있나요?** ADR 0001은 하루 1,000건이라고 적었는데, 이번에 공개 페이지에서는 다시 확인하지 못했습니다.
   - 추천: SK open API 콘솔의 "API 사용 요금"에서 확인. 1,000건이 맞으면 이 설계(구간 최대 210건)는 그대로 갑니다.
7. **장소를 더 넣을까요?** 후보: 우면산 둘레길 다른 입구, 서울중앙지법 쪽 산책로, 서초역 근처 작은 공원.
   - 추천: **6곳으로 시작**하고, 써 보면서 관리자 화면(7단계)으로 늘립니다.

## 참고

- 경유지 최대 5곳, `passList` 형식: [TMAP 보행자 경로안내](https://tmap-skopenapi.readme.io/reference/%EB%B3%B4%ED%96%89%EC%9E%90-%EA%B2%BD%EB%A1%9C%EC%95%88%EB%82%B4)
- 서리풀공원·누에다리·몽마르뜨공원 연결, 서초역에서 걸어서 9분: [서울시 내 손안에 서울 — 몽마르뜨공원](https://mediahub.seoul.go.kr/archives/1278845), [도심 속 숲 여행](https://mediahub.seoul.go.kr/archives/2005907)
- 좌표: [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) 검색 결과 (2026-10-22)
