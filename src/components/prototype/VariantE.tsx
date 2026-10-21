"use client";

// PROTOTYPE (throwaway) 시안 E "랭킹 보드 + 목록 + 꿀팁 + 키워드": D의 진한 테마에
// A의 목록·필터·가게 카드와 모든 사람의 꿀팁 피드, 키워드를 합친 것 (읽기 전용)
import { useMemo, useState, useSyncExternalStore } from "react";
import { CATEGORIES, type Category } from "@/lib/domain";
import { NaverMap, CATEGORY_EMOJI } from "../NaverMap";
import { BottomSheet, type SheetSnap } from "../BottomSheet";
import { CATEGORY_COLOR, minutes, usePrototypeData, type ProtoPlace } from "./usePrototypeData";

export const name = "랭킹+목록+꿀팁";

type Tab = "rank" | "list" | "feed";

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );
}

// 키워드: 노션 비고에서 반복해서 나온 관심사 8개
const KEYWORDS = [
  { key: "tasty", label: "😋 맛있음", re: /맛있|맛집|후회하지 않을 맛/ },
  { key: "value", label: "💸 가성비", re: /쌈|가성비|혜자/ },
  { key: "portion", label: "🍚 양 많음", re: /푸짐|사이즈업|그릇이 크|든든/ },
  { key: "fast", label: "⚡ 빨리 나옴", re: /빨리|빠름/ },
  { key: "solo", label: "🙋 혼밥 OK", re: /혼밥/ },
  { key: "group", label: "👥 단체 OK", re: /여러명|나눠먹/ },
  { key: "nowait", label: "🕐 웨이팅 없음", re: /바로 먹을 수/ },
  { key: "takeout", label: "🥡 포장 OK", re: /사올 수|포장/ },
] as const;
type KeywordKey = (typeof KEYWORDS)[number]["key"];

// PROTOTYPE: 아직 키워드 데이터가 없어서, 꿀팁 글과 노션의 혼밥 값으로 예시 개수를 만든다
function demoKeywordCounts(p: ProtoPlace): Record<KeywordKey, number> {
  const text = p.comments.map((c) => c.body).join("\n");
  const counts = Object.fromEntries(KEYWORDS.map((k) => [k.key, k.re.test(text) ? 1 + (text.length % 3) : 0])) as Record<KeywordKey, number>;
  if (p.solo_dining === "yes") counts.solo = Math.max(counts.solo, 1);
  return counts;
}

const WEEK = 7 * 24 * 3600 * 1000;
// 이번 주: 최근 7일 꿀팁 수 + 좋아요(시안에서는 좋아요 시각이 없어 전체 좋아요로 대신). 전체: 좋아요 − 싫어요
const weeklyScore = (p: ProtoPlace) => p.likes * 2 + p.comments.filter((c) => Date.now() - new Date(c.created_at).getTime() < WEEK).length;
const allTimeScore = (p: ProtoPlace) => p.likes - p.dislikes;

function ago(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  return `${Math.floor(d / 86400)}일 전`;
}

function Dot({ c }: { c: Category }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[c] }} />;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold ${on ? "bg-[#03c75a] text-[#0b2b18]" : "bg-white/8 text-white/70 hover:bg-white/15"}`}>
      {children}
    </button>
  );
}

export function VariantE() {
  const places = usePrototypeData();
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<Tab>("rank");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [rolling, setRolling] = useState(false);
  const [category, setCategory] = useState<Category | "all">("all");
  const [kwFilter, setKwFilter] = useState<KeywordKey | null>(null);
  const [maxMin, setMaxMin] = useState<number | null>(null);
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [myKeywords, setMyKeywords] = useState<Record<string, KeywordKey[]>>({});

  const all = useMemo(() => places ?? [], [places]);
  const kwCounts = useMemo(() => Object.fromEntries(all.map((p) => [p.id, demoKeywordCounts(p)])), [all]);
  const weekEmpty = all.every((p) => weeklyScore(p) === 0);
  const usePeriod = period === "week" && weekEmpty ? "all" : period;
  const ranked = useMemo(() => {
    const s = usePeriod === "week" ? weeklyScore : allTimeScore;
    return [...all].sort((a, b) => s(b) - s(a) || (a.walking_seconds ?? 0) - (b.walking_seconds ?? 0));
  }, [all, usePeriod]);
  const listed = useMemo(
    () =>
      all.filter(
        (p) => (category === "all" || p.category === category) && (!kwFilter || (kwCounts[p.id]?.[kwFilter] ?? 0) > 0) && (maxMin == null || minutes(p) <= maxMin),
      ),
    [all, category, kwFilter, kwCounts, maxMin],
  );
  const toggleMyKeyword = (placeId: string, k: KeywordKey) =>
    setMyKeywords((m) => {
      const cur = m[placeId] ?? [];
      if (cur.includes(k)) return { ...m, [placeId]: cur.filter((x) => x !== k) };
      if (cur.length >= 5) return m;
      return { ...m, [placeId]: [...cur, k] };
    });
  const feed = useMemo(
    () => all.flatMap((p) => p.comments.map((c) => ({ c, p }))).sort((a, b) => b.c.created_at.localeCompare(a.c.created_at)),
    [all],
  );
  const selected = all.find((p) => p.id === selectedId) ?? null;
  const mapPlaces = tab === "list" ? listed : all;

  const select = (id: string | null) => {
    setSelectedId(id);
    if (id) setSnap("full");
  };

  const roll = () => {
    const pool = tab === "list" ? listed : all;
    if (!pool.length) return;
    setRolling(true);
    let n = 0;
    const t = setInterval(() => {
      setSelectedId(pool[Math.floor(Math.random() * pool.length)].id);
      if (++n > 10) {
        clearInterval(t);
        setRolling(false);
        setSnap("full");
      }
    }, 90);
  };

  const detail = selected && (
    <div className="px-5 pb-28 pt-2">
      <button onClick={() => setSelectedId(null)} className="text-sm font-bold text-white/50 hover:text-white">
        ← {tab === "rank" ? "랭킹" : tab === "list" ? "목록" : "꿀팁"}으로
      </button>
      <p className="mt-3 flex items-center gap-2 text-xs font-extrabold" style={{ color: CATEGORY_COLOR[selected.category] }}>
        <Dot c={selected.category} /> {selected.category} · #{ranked.findIndex((p) => p.id === selected.id) + 1}위
      </p>
      <h2 className="mt-1 text-2xl font-black">
        {CATEGORY_EMOJI[selected.category]} {selected.name}
      </h2>
      <p className="mt-1 text-sm text-white/55">
        🚶 도보 {minutes(selected)}분 · {selected.walking_meters}m
      </p>
      <p className="text-sm text-white/40">{selected.road_address}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="rounded-xl bg-white/8 py-3 font-bold">👍 좋아요 {selected.likes}</button>
        <button className="rounded-xl bg-white/8 py-3 font-bold">👎 싫어요 {selected.dislikes}</button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-sm font-bold">
        <button className="rounded-xl bg-white py-2.5 text-[#14151a]">📋 메뉴판</button>
        <button className="rounded-xl bg-white/8 py-2.5">📷 사진</button>
        <button className="rounded-xl bg-white/8 py-2.5">⭐ 리뷰</button>
      </div>
      <h3 className="mt-7 text-lg font-black">이런 점이 좋았어요</h3>
      <ul className="mt-2 space-y-1.5">
        {(() => {
          const counts = kwCounts[selected.id];
          const mine = myKeywords[selected.id] ?? [];
          const rows = KEYWORDS.map((k) => ({ ...k, n: (counts?.[k.key] ?? 0) + (mine.includes(k.key) ? 1 : 0) }))
            .filter((k) => k.n > 0)
            .sort((a, b) => b.n - a.n);
          const max = Math.max(1, ...rows.map((r) => r.n));
          if (!rows.length) return <li className="text-sm text-white/40">아직 고른 사람이 없어요. 첫 키워드를 남겨 주세요!</li>;
          return rows.map((r) => (
            <li key={r.key} className="relative overflow-hidden rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span className="absolute inset-y-0 left-0 bg-[#03c75a]/25" style={{ width: `${(r.n / max) * 100}%` }} />
              <span className="relative flex justify-between font-bold">
                <span>{r.label}</span>
                <span className="text-[#03c75a]">{r.n}</span>
              </span>
            </li>
          ));
        })()}
      </ul>
      <p className="mt-4 text-xs font-bold text-white/50">내가 고른 키워드 ({(myKeywords[selected.id] ?? []).length}/5)</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {KEYWORDS.map((k) => {
          const on = (myKeywords[selected.id] ?? []).includes(k.key);
          return (
            <button
              key={k.key}
              onClick={() => toggleMyKeyword(selected.id, k.key)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-bold ${on ? "border-[#03c75a] bg-[#03c75a] text-[#0b2b18]" : "border-white/15 text-white/70 hover:bg-white/10"}`}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <h3 className="mt-7 text-lg font-black">💡 꿀팁 {selected.comments.length}</h3>
      <ul className="mt-2 space-y-2">
        {selected.comments.length === 0 && <li className="text-sm text-white/40">아직 꿀팁이 없어요</li>}
        {selected.comments.map((c) => (
          <li key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">{c.body}</p>
            <p className="mt-1.5 text-xs text-white/40">
              {c.nickname || "익명"} · {ago(c.created_at)}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl border border-dashed border-white/15 p-3 text-sm text-white/40">추천 메뉴, 가격, 가는 길… 꿀팁 남기기</div>
    </div>
  );

  const panel = (
    <div className="flex h-full flex-col bg-[#14151a] text-white">
      <div className="shrink-0 px-5 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#03c75a]">MYEONGJEONG LUNCH</p>
            <h1 className="text-xl font-black">명정 점심 지도</h1>
          </div>
          <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold">+ 맛집 추가</button>
        </div>
        <button onClick={roll} className="mt-3 w-full rounded-2xl bg-[#03c75a] py-3.5 text-lg font-black text-[#0b2b18] shadow-[0_0_30px_rgba(3,199,90,0.35)] active:scale-[0.98]">
          🎲 {rolling ? "고르는 중…" : tab === "list" && listed.length !== all.length ? `조건 안에서 뭐 먹지? (${listed.length}곳)` : "오늘 뭐 먹지?"}
        </button>
        {!selected && (
          <div className="mt-3 grid grid-cols-3 rounded-xl bg-white/5 p-1 text-sm font-bold">
            {(
              [
                ["rank", "🏆 랭킹"],
                ["list", "📍 목록"],
                ["feed", "💡 꿀팁"],
              ] as [Tab, string][]
            ).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-lg py-2 ${tab === k ? "bg-white text-[#14151a]" : "text-white/60"}`}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {places == null ? (
          <p className="p-5 text-sm text-white/40">불러오는 중…</p>
        ) : selected ? (
          detail
        ) : tab === "rank" ? (
          <ol className="px-3 pb-28">
            <li className="flex items-center gap-2 px-2 pb-2">
              <div className="flex rounded-full bg-white/5 p-0.5 text-xs font-bold">
                {(
                  [
                    ["week", "이번 주"],
                    ["all", "전체"],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} onClick={() => setPeriod(k)} className={`rounded-full px-3 py-1 ${period === k ? "bg-white text-[#14151a]" : "text-white/60"}`}>
                    {l}
                  </button>
                ))}
              </div>
              {period === "week" && weekEmpty && <span className="text-[11px] text-white/40">이번 주 기록이 없어 전체 순위를 보여 줘요</span>}
            </li>
            {ranked.map((p, i) => (
              <li key={p.id}>
                <button onClick={() => select(p.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/5">
                  <span className={`w-8 text-center text-xl font-black ${i < 3 ? "text-[#ffd166]" : "text-white/30"}`}>{i + 1}</span>
                  <Dot c={p.category} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.name}</span>
                    <span className="block text-xs text-white/45">
                      {p.category} · 🚶 {minutes(p)}분
                    </span>
                  </span>
                  <span className="text-right text-xs font-bold text-white/60">
                    👍 {p.likes}
                    <br />💬 {p.comment_count}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : tab === "list" ? (
          <div className="pb-28">
            <div className="space-y-2 px-4 pb-3">
              <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
                <Chip on={category === "all"} onClick={() => setCategory("all")}>
                  전체
                </Chip>
                {CATEGORIES.map((c) => (
                  <Chip key={c} on={category === c} onClick={() => setCategory(category === c ? "all" : c)}>
                    {CATEGORY_EMOJI[c]} {c}
                  </Chip>
                ))}
              </div>
              <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
                {KEYWORDS.map((k) => (
                  <Chip key={k.key} on={kwFilter === k.key} onClick={() => setKwFilter(kwFilter === k.key ? null : k.key)}>
                    {k.label}
                  </Chip>
                ))}
              </div>
              <div className="flex gap-1.5">
                {[5, 10].map((m) => (
                  <Chip key={m} on={maxMin === m} onClick={() => setMaxMin(maxMin === m ? null : m)}>
                    🚶 {m}분 이내
                  </Chip>
                ))}
              </div>
            </div>
            <ul>
              {listed.length === 0 && <li className="p-6 text-center text-sm text-white/40">조건에 맞는 가게가 없어요</li>}
              {listed.map((p) => (
                <li key={p.id}>
                  <button onClick={() => select(p.id)} className="flex w-full items-start gap-3 border-t border-white/5 px-4 py-3.5 text-left hover:bg-white/5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl" style={{ background: `${CATEGORY_COLOR[p.category]}33` }}>
                      {CATEGORY_EMOJI[p.category]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="truncate font-bold">{p.name}</span>
                        <span className="shrink-0 text-xs text-white/40">{p.category}</span>
                      </span>
                      <span className="mt-0.5 block text-[13px] text-white/50">
                        <b className="text-white">🚶 {minutes(p)}분</b>
                        {(() => {
                          const top = KEYWORDS.map((k) => ({ ...k, n: kwCounts[p.id]?.[k.key] ?? 0 })).sort((a, b) => b.n - a.n)[0];
                          return top && top.n > 0 ? ` · ${top.label} ${top.n}` : "";
                        })()}
                      </span>
                      {p.latestComment && <span className="mt-1 block truncate text-[13px] text-white/40">“{p.latestComment.body.split("\n")[0]}”</span>}
                    </span>
                    <span className="shrink-0 text-right text-xs font-bold text-white/50">
                      👍 {p.likes}
                      <br />💬 {p.comment_count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="space-y-2 px-4 pb-28">
            {feed.map(({ c, p }) => (
              <li key={c.id}>
                <button onClick={() => select(p.id)} className="w-full rounded-xl border border-white/10 bg-white/5 p-3.5 text-left hover:bg-white/10">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">
                    <Dot c={p.category} /> {p.name} · 🚶 {minutes(p)}분
                  </span>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-white/85">{c.body}</p>
                  <p className="mt-1.5 text-xs text-white/40">
                    {c.nickname || "익명"} · {ago(c.created_at)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="proto-dark relative flex h-dvh w-full overflow-hidden bg-[#14151a]">
      <style>{`
        .proto-dark .lm-marker:not(.campus){background:#14151a;color:#fff;border-color:#14151a}
        .proto-dark .lm-marker:not(.campus)::after{border-top-color:#14151a}
        .proto-dark .lm-marker .emoji{background:#2a2c35}
        .proto-dark .lm-marker.selected{background:#03c75a;border-color:#03c75a;color:#0b2b18;transform:translate(-50%,-100%) scale(1.15)}
        .proto-dark .lm-marker.selected::after{border-top-color:#03c75a}
      `}</style>
      {isDesktop && <aside className="z-10 h-full w-[400px] shrink-0">{panel}</aside>}
      <main className="relative h-full flex-1">
        <NaverMap places={mapPlaces} selectedId={selectedId} onSelect={select} pickMode={false} picked={null} onPick={() => {}} bottomInset={0} />
        {!isDesktop && (
          <BottomSheet snap={snap} onSnap={setSnap}>
            {panel}
          </BottomSheet>
        )}
      </main>
    </div>
  );
}
