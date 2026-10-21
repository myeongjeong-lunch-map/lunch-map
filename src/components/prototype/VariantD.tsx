"use client";

// PROTOTYPE (throwaway) 시안 D "랭킹 보드": 진한 테마 + 화제성 순위 + 큰 랜덤 추천 버튼
import { useMemo, useState, useSyncExternalStore } from "react";
import { NaverMap, CATEGORY_EMOJI } from "../NaverMap";
import { BottomSheet, type SheetSnap } from "../BottomSheet";
import { CATEGORY_COLOR, firstLine, minutes, usePrototypeData, type ProtoPlace } from "./usePrototypeData";

export const name = "랭킹 보드";

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

// 화제성: 좋아요는 2점, 한마디는 1점, 싫어요는 -1점. 같으면 가까운 순
const score = (p: ProtoPlace) => p.likes * 2 + p.comment_count - p.dislikes;

export function VariantD() {
  const places = usePrototypeData();
  const isDesktop = useIsDesktop();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [rolling, setRolling] = useState(false);

  const ranked = useMemo(() => [...(places ?? [])].sort((a, b) => score(b) - score(a) || (a.walking_seconds ?? 0) - (b.walking_seconds ?? 0)), [places]);
  const picked = ranked.find((p) => p.id === selectedId) ?? null;

  const roll = () => {
    if (!ranked.length) return;
    setRolling(true);
    let n = 0;
    const t = setInterval(() => {
      setSelectedId(ranked[Math.floor(Math.random() * ranked.length)].id);
      if (++n > 10) {
        clearInterval(t);
        setRolling(false);
      }
    }, 90);
  };

  const panel = (
    <div className="flex h-full flex-col bg-[#14151a] text-white">
      <div className="px-5 pb-4 pt-5">
        <p className="text-xs font-bold tracking-widest text-[#03c75a]">MYEONGJEONG LUNCH</p>
        <h1 className="mt-1 text-2xl font-black">🏆 이번 주 점심 랭킹</h1>
        <button
          onClick={roll}
          className="mt-4 w-full rounded-2xl bg-[#03c75a] py-4 text-lg font-black text-[#0b2b18] shadow-[0_0_30px_rgba(3,199,90,0.35)] active:scale-[0.98]"
        >
          🎲 {rolling ? "고르는 중…" : "오늘 뭐 먹지?"}
        </button>
        {picked && !rolling && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold text-white/50">오늘의 선택</p>
            <p className="mt-1 text-xl font-black">
              {CATEGORY_EMOJI[picked.category]} {picked.name}
            </p>
            <p className="mt-1 text-sm text-white/60">
              🚶 {minutes(picked)}분 · {firstLine(picked.latestComment, 40) || "한마디 없음"}
            </p>
          </div>
        )}
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto px-3 pb-24">
        {places == null && <li className="p-4 text-sm text-white/50">불러오는 중…</li>}
        {ranked.map((p, i) => (
          <li key={p.id}>
            <button
              onClick={() => setSelectedId(p.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/5 ${p.id === selectedId ? "bg-white/10" : ""}`}
            >
              <span className={`w-8 text-center text-xl font-black ${i < 3 ? "text-[#ffd166]" : "text-white/30"}`}>{i + 1}</span>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[p.category] }} />
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
      {isDesktop && <aside className="z-10 h-full w-[380px] shrink-0">{panel}</aside>}
      <main className="relative h-full flex-1">
        <NaverMap places={ranked} selectedId={selectedId} onSelect={setSelectedId} pickMode={false} picked={null} onPick={() => {}} bottomInset={0} />
        {!isDesktop && (
          <BottomSheet snap={snap} onSnap={setSnap}>
            {panel}
          </BottomSheet>
        )}
      </main>
    </div>
  );
}
