import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  CAMPUS,
  CATEGORIES,
  haversine,
  STALL_KIND_LABEL,
  STALL_KINDS,
  type StallKind,
  courseTime,
  drawCandidates,
  drawWeights,
  KEYWORD_LABEL,
  KEYWORDS,
  legKey,
  naverMapUrl,
  ranking,
  timeAgo,
  walkingMinutes,
  type KeywordKey,
  type Place,
} from "@/lib/domain";
import { db } from "@/lib/server/supabase";
import { readPlaceList } from "@/lib/server/placeList";
import { listTeams, teamDetail } from "@/lib/server/teamViews";
import { readWalkData } from "@/lib/server/walkData";
import { readStreetStalls } from "@/lib/server/street";

// 점심 지도 MCP 도구. 모두 읽기 전용이다 (쓰기는 팀 토큰과 함께 다음 단계, 이슈 #21).
// 결과는 Claude가 그대로 읽고 사람에게 옮기기 쉬운 짧은 한국어 글로 돌려준다.

const STALL_KIND_KEYS = STALL_KINDS.map((k) => k.key) as [StallKind, ...StallKind[]];
const KEYWORD_KEYS = KEYWORDS.map((k) => k.key) as [KeywordKey, ...KeywordKey[]];

const filterShape = {
  query: z.string().max(40).optional().describe("가게 이름에 들어가는 글자 (예: 국밥, 김밥천국)"),
  category: z.enum(CATEGORIES).optional().describe("카테고리"),
  keyword: z
    .enum(KEYWORD_KEYS)
    .optional()
    .describe(`키워드: ${KEYWORDS.map((k) => `${k.key}=${k.label}`).join(", ")}`),
  maxMinutes: z.number().int().min(1).max(60).optional().describe("캠퍼스(명정빌딩)에서 걸어서 최대 몇 분"),
};
type Filter = { query?: string; category?: (typeof CATEGORIES)[number]; keyword?: KeywordKey; maxMinutes?: number };

function matches(p: Place, f: Filter): boolean {
  if (f.query && !p.name.replace(/\s/g, "").includes(f.query.replace(/\s/g, ""))) return false;
  if (f.category && p.category !== f.category) return false;
  if (f.keyword && !p.keywords[f.keyword]) return false;
  const min = walkingMinutes(p);
  if (f.maxMinutes && (min == null || min > f.maxMinutes)) return false;
  return true;
}

function topKeywords(p: Place, n = 3): string {
  return (Object.entries(p.keywords) as [KeywordKey, number][])
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, c]) => `${KEYWORD_LABEL[k]} ${c}`)
    .join(", ");
}

/** 목록 한 줄 */
function line(p: Place): string {
  const min = walkingMinutes(p);
  const kw = topKeywords(p);
  return `- ${p.name} (${p.category}) · 도보 ${min == null ? "?" : min}분 · 👍${p.likes} 👎${p.dislikes} · 꿀팁 ${p.tip_count}${kw ? ` · ${kw}` : ""} [id: ${p.id}]`;
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

async function places(): Promise<Place[]> {
  return (await readPlaceList(null)).places;
}

export function registerLunchTools(server: McpServer): void {
  server.registerTool(
    "search_places",
    {
      title: "가게 찾기",
      description: "명정 캠퍼스(서울 서초구 반포대로 45 명정빌딩) 점심 지도에 등록된 가게를 조건으로 찾는다. 가까운 순.",
      inputSchema: z.object({ ...filterShape, limit: z.number().int().min(1).max(30).default(10).describe("최대 몇 곳") }),
      annotations: { readOnlyHint: true },
    },
    async (f) => {
      const found = (await places()).filter((p) => matches(p, f)).sort((a, b) => (a.walking_seconds ?? Infinity) - (b.walking_seconds ?? Infinity));
      if (!found.length) return text("조건에 맞는 가게가 없어요.");
      return text(`${found.length}곳 중 ${Math.min(found.length, f.limit)}곳:\n${found.slice(0, f.limit).map(line).join("\n")}`);
    },
  );

  server.registerTool(
    "get_place",
    {
      title: "가게 자세히 보기",
      description: "가게 하나의 주소, 도보 시간, 평가, 키워드, 최근 꿀팁, 네이버 지도 링크. id나 이름 중 하나를 준다.",
      inputSchema: z.object({ id: z.string().uuid().optional(), name: z.string().max(60).optional().describe("가게 이름 (일부만 써도 된다)") }),
      annotations: { readOnlyHint: true },
    },
    async ({ id, name }) => {
      const all = await places();
      const key = name?.replace(/\s/g, "");
      const p = id
        ? all.find((x) => x.id === id)
        : key
          ? (all.find((x) => x.name.replace(/\s/g, "") === key) ?? all.find((x) => x.name.replace(/\s/g, "").includes(key)))
          : undefined;
      if (!p) return text("가게를 찾지 못했어요. search_places로 먼저 찾아 보세요.");
      const { data: tips, error } = await db()
        .from("tips")
        .select("body, nickname, created_at")
        .eq("place_id", p.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      const min = walkingMinutes(p);
      const kw = topKeywords(p, 8);
      return text(
        [
          `${p.name} (${p.category}${p.naver_category ? ` · ${p.naver_category}` : ""})`,
          `주소: ${p.road_address}`,
          `도보: ${min == null ? "모름" : `${min}분`}${p.walking_meters != null ? ` · ${p.walking_meters}m` : ""} (캠퍼스 기준)`,
          `평가: 👍${p.likes} 👎${p.dislikes}`,
          `키워드: ${kw || "아직 없음"}`,
          `네이버 지도: ${naverMapUrl(p)}`,
          `최근 꿀팁${tips?.length ? "" : ": 아직 없음"}`,
          ...(tips ?? []).map((t) => `- ${t.body.replace(/\s+/g, " ")} (${t.nickname || "익명"}, ${timeAgo(t.created_at)})`),
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "get_ranking",
    {
      title: "랭킹",
      description: "가게 랭킹. week=이번 주(최근 7일 좋아요×2 + 꿀팁), all=전체(좋아요 − 싫어요). 이번 주 기록이 없으면 전체를 보여 준다.",
      inputSchema: z.object({ period: z.enum(["week", "all"]).default("week"), limit: z.number().int().min(1).max(30).default(10) }),
      annotations: { readOnlyHint: true },
    },
    async ({ period, limit }) => {
      const r = ranking(await places(), period);
      const head = r.fellBack ? "이번 주 기록이 없어 전체 순위예요." : r.period === "week" ? "이번 주 랭킹" : "전체 랭킹";
      return text(
        `${head}\n${r.ranked
          .slice(0, limit)
          .map((p, i) => `${i + 1}. ${line(p).slice(2)}`)
          .join("\n")}`,
      );
    },
  );

  server.registerTool(
    "pick_lunch",
    {
      title: "오늘 뭐 먹지",
      description: "조건 안에서 가게 하나를 무작위로 골라 준다.",
      inputSchema: z.object(filterShape),
      annotations: { readOnlyHint: true },
    },
    async (f) => {
      const pool = (await places()).filter((p) => matches(p, f));
      if (!pool.length) return text("조건에 맞는 가게가 없어요.");
      const p = pool[Math.floor(Math.random() * pool.length)];
      return text(`🎲 ${pool.length}곳 중에서 골랐어요.\n${line(p).slice(2)}\n네이버 지도: ${naverMapUrl(p)}`);
    },
  );

  server.registerTool(
    "get_team_box",
    {
      title: "팀 추첨통 보기",
      description: "팀의 열린 추첨통: 들어 있는 가게, 넣은 횟수, 다음에 뽑힐 확률, 넣은 사람 닉네임, 이번 추첨통의 회차별 결과. 팀 이름을 준다.",
      inputSchema: z.object({ team: z.string().min(1).max(30).describe("팀 이름 (일부만 써도 된다)") }),
      annotations: { readOnlyHint: true },
    },
    async ({ team }) => {
      const teams = await listTeams(null);
      const t = teams.find((x) => x.name === team) ?? teams.find((x) => x.name.includes(team));
      if (!t) return text(`"${team}" 팀이 없어요. 팀: ${teams.map((x) => x.name).join(", ") || "없음"}`);
      const [detail, all] = await Promise.all([teamDetail(t.id, null), places()]);
      const byId = new Map(all.map((p) => [p.id, p]));
      const box = detail.open_box;
      if (!box) return text(`${t.name}: 열린 추첨통이 없어요.`);
      const nameOf = (id: string | null) => (id ? (byId.get(id)?.name ?? "삭제된 가게") : "삭제된 가게");
      const candidates = drawWeights(drawCandidates(box.entries, box.results));
      const total = candidates.reduce((n, c) => n + c.weight, 0);
      const who = new Map<string, Set<string>>();
      for (const e of box.entries) (who.get(e.place_id) ?? who.set(e.place_id, new Set()).get(e.place_id)!).add(e.nickname);
      return text(
        [
          `${t.name} 추첨통 (한 사람 최대 ${box.per_member_limit}번)`,
          ...box.results.map((r) => `${r.round}차에 뽑힘: ${nameOf(r.place_id)}`),
          box.results.length ? "다음 추첨 후보 (뽑힌 가게 제외):" : "후보:",
          ...candidates.map(
            (c) =>
              `- ${nameOf(c.place_id)} · 🎟️×${c.weight} · ${Math.round((c.weight / total) * 100)}% · 넣은 사람: ${[...(who.get(c.place_id) ?? [])].join(", ")}`,
          ),
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "list_street_stalls",
    {
      title: "지금 길거리 노점",
      description:
        "지금 지도에 보이는 길거리 제보(붕어빵·호떡·군고구마·군밤·어묵·떡볶이·푸드트럭 노점). 일일 노점은 몇 분 전에 확인됐는지, 고정 노점은 오늘 영업 여부. 종류로 거를 수 있다.",
      inputSchema: z.object({
        kind: z
          .enum(STALL_KIND_KEYS)
          .optional()
          .describe(`종류: ${STALL_KINDS.map((k) => `${k.key}=${k.label}`).join(", ")}`),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ kind }) => {
      const list = (await readStreetStalls(null)).filter((s) => !kind || s.kind === kind);
      if (!list.length) return text(kind ? `지금 보이는 ${STALL_KIND_LABEL[kind]} 노점이 없어요.` : "지금 보이는 길거리 노점이 없어요.");
      return text(
        `지금 길거리 ${list.length}곳:\n` +
          list
            .map((s) => {
              const min = Math.max(1, Math.round((haversine(CAMPUS.lat, CAMPUS.lng, s.lat, s.lng) * 1.3) / 66.7));
              const state = !s.fixed
                ? `일일 · ${timeAgo(s.last_seen_at)} 확인`
                : s.today === "open"
                  ? "고정 · 오늘 영업"
                  : s.today === "closed"
                    ? "고정 · 오늘 닫음"
                    : `고정 · 마지막 확인 ${timeAgo(s.last_seen_at)}`;
              return `- ${STALL_KIND_LABEL[s.kind]}${s.memo ? ` (${s.memo})` : ""} · ${state} · 캠퍼스에서 약 ${min}분 · https://map.naver.com/p/?c=${s.lng},${s.lat},18,0,0,0,dh`;
            })
            .join("\n"),
      );
    },
  );

  server.registerTool(
    "list_walk_courses",
    {
      title: "산책 코스",
      description: "점심 먹고 걷기 좋은 추천 산책 코스와 코스 시간(캠퍼스 → 장소들 → 캠퍼스, 걷는 시간 + 둘러보는 시간).",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const w = await readWalkData();
      const spots = new Map(w.spots.map((s) => [s.id, s]));
      const legs = new Map(w.legs.map((l) => [legKey(l.a, l.b), l]));
      if (!w.courses.length) return text("등록된 산책 코스가 없어요.");
      return text(
        w.courses
          .map((c) => {
            const time = courseTime(c.stops, spots, legs);
            const route = ["캠퍼스", ...c.stops.map((s) => spots.get(s.spot_id)?.name ?? "?"), "캠퍼스"].join(" → ");
            return `- ${c.name}: ${time.rough ? "약 " : ""}${time.totalMinutes}분 (${route})${c.summary ? ` — ${c.summary}` : ""}`;
          })
          .join("\n"),
      );
    },
  );
}
