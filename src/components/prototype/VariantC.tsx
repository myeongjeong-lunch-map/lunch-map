"use client";

// PROTOTYPE (throwaway) 시안 C "매거진": 히어로 + 도보 거리별 묶음 + 한마디 미리보기 카드
import { useState, useSyncExternalStore } from "react";
import { SOLO_LABEL } from "@/lib/domain";
import { NaverMap, CATEGORY_EMOJI } from "../NaverMap";
import { BottomSheet, type SheetSnap } from "../BottomSheet";
import { CATEGORY_COLOR, firstLine, minutes, usePrototypeData, type ProtoPlace } from "./usePrototypeData";

export const name = "매거진";

const SECTIONS = [
  { title: "엎어지면 코 닿는 곳", sub: "3분 이내", test: (m: number) => m <= 3 },
  { title: "산책 겸 다녀오기", sub: "4~6분", test: (m: number) => m >= 4 && m <= 6 },
  { title: "조금 걷더라도 가볼 만한", sub: "7분 이상", test: (m: number) => m >= 7 },
];

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

function Card({ p, active, onClick }: { p: ProtoPlace; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative w-full overflow-hidden rounded-2xl border bg-white p-4 pl-5 text-left transition hover:shadow-md ${active ? "border-brand shadow-md" : "border-line"}`}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: CATEGORY_COLOR[p.category] }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-wide" style={{ color: CATEGORY_COLOR[p.category] }}>
            {CATEGORY_EMOJI[p.category]} {p.category.toUpperCase()}
          </p>
          <h3 className="mt-0.5 truncate text-[17px] font-black">{p.name}</h3>
        </div>
        <span className="shrink-0 rounded-lg bg-foreground px-2 py-1 text-xs font-extrabold text-white">🚶 {minutes(p)}분</span>
      </div>
      {p.latestComment ? (
        <blockquote className="mt-3 rounded-xl bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-foreground/80">
          “{firstLine(p.latestComment, 80)}”
          <span className="mt-1 block text-[11px] font-semibold text-muted">— {p.latestComment.nickname || "익명"}</span>
        </blockquote>
      ) : (
        <p className="mt-3 text-[13px] text-muted">첫 한마디를 남겨 주세요</p>
      )}
      <p className="mt-2.5 flex gap-3 text-xs font-semibold text-muted">
        <span>👍 {p.likes}</span>
        <span>💬 {p.comment_count}</span>
        <span>{SOLO_LABEL[p.solo_dining]}</span>
      </p>
    </button>
  );
}

export function VariantC() {
  const places = usePrototypeData();
  const isDesktop = useIsDesktop();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<SheetSnap>("half");
  const all = places ?? [];
  const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });

  const panel = (
    <div className="h-full overflow-y-auto bg-[#fafaf7]">
      <header className="bg-gradient-to-br from-[#03c75a] to-[#0a8f4a] px-5 pb-6 pt-5 text-white">
        <p className="text-xs font-bold opacity-80">{today}</p>
        <h1 className="mt-1 text-2xl font-black leading-tight">
          오늘 점심,
          <br />
          어디 갈까요?
        </h1>
        <div className="mt-4 flex gap-2 text-xs font-bold">
          <span className="rounded-full bg-white/20 px-3 py-1.5">🍱 {all.length}곳</span>
          <span className="rounded-full bg-white/20 px-3 py-1.5">🚶 5분 이내 {all.filter((p) => minutes(p) <= 5).length}곳</span>
          <span className="rounded-full bg-white/20 px-3 py-1.5">🙋 혼밥 {all.filter((p) => p.solo_dining === "yes").length}곳</span>
        </div>
      </header>
      {places == null && <p className="p-6 text-sm text-muted">불러오는 중…</p>}
      {SECTIONS.map((s) => {
        const items = all.filter((p) => s.test(minutes(p)));
        if (!items.length) return null;
        return (
          <section key={s.title} className="px-4 pt-6">
            <h2 className="flex items-baseline gap-2 px-1 text-lg font-black">
              {s.title}
              <span className="text-xs font-bold text-muted">{s.sub} · {items.length}곳</span>
            </h2>
            <div className="mt-3 space-y-3">
              {items.map((p) => (
                <Card key={p.id} p={p} active={p.id === selectedId} onClick={() => setSelectedId(p.id)} />
              ))}
            </div>
          </section>
        );
      })}
      <div className="h-24" />
    </div>
  );

  return (
    <div className="relative flex h-dvh w-full overflow-hidden">
      {isDesktop && <aside className="z-10 h-full w-[420px] shrink-0 border-r border-line shadow-lg">{panel}</aside>}
      <main className="relative h-full flex-1">
        <NaverMap places={all} selectedId={selectedId} onSelect={setSelectedId} pickMode={false} picked={null} onPick={() => {}} bottomInset={0} />
        {!isDesktop && (
          <BottomSheet snap={snap} onSnap={setSnap}>
            {panel}
          </BottomSheet>
        )}
      </main>
    </div>
  );
}
