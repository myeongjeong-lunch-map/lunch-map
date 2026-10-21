"use client";

// PROTOTYPE (throwaway) 시안 B "떠 있는 카드": 사이드바 없이 지도 전체 + 위 검색/칩 + 아래 가로 카드 캐러셀
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, SOLO_LABEL, type Category } from "@/lib/domain";
import { NaverMap, CATEGORY_EMOJI } from "../NaverMap";
import { CATEGORY_COLOR, firstLine, minutes, usePrototypeData } from "./usePrototypeData";

export const name = "떠 있는 카드";

export function VariantB() {
  const places = usePrototypeData();
  const [category, setCategory] = useState<Category | "all">("all");
  const [text, setText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const visible = useMemo(
    () => (places ?? []).filter((p) => (category === "all" || p.category === category) && (!text || p.name.includes(text))),
    [places, category, text],
  );

  useEffect(() => {
    if (selectedId) cardRefs.current.get(selectedId)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedId]);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <NaverMap places={visible} selectedId={selectedId} onSelect={setSelectedId} pickMode={false} picked={null} onPick={() => {}} bottomInset={220} />

      {/* 위: 떠 있는 검색창 + 카테고리 칩 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2 p-3 md:left-4 md:right-auto md:w-[440px]">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
          <span className="text-lg">🍱</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="명정 근처 점심 검색" className="min-w-0 flex-1 text-[15px] outline-none" />
          <button className="rounded-full bg-brand px-3 py-1.5 text-xs font-extrabold text-white">+ 추가</button>
        </div>
        <div className="no-scrollbar pointer-events-auto -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
          {(["all", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold shadow-md ${category === c ? "bg-foreground text-white" : "bg-white text-foreground"}`}
            >
              {c === "all" ? "전체" : `${CATEGORY_EMOJI[c]} ${c}`}
            </button>
          ))}
        </div>
      </div>

      {/* 아래: 가로로 넘기는 카드 */}
      <div className="no-scrollbar absolute inset-x-0 bottom-16 z-20 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
        {places == null && <div className="rounded-2xl bg-white p-5 text-sm text-muted shadow-lg">불러오는 중…</div>}
        {visible.map((p) => {
          const active = p.id === selectedId;
          return (
            <article
              key={p.id}
              ref={(el) => {
                if (el) cardRefs.current.set(p.id, el);
              }}
              onClick={() => setSelectedId(p.id)}
              className={`w-[290px] shrink-0 snap-center cursor-pointer rounded-2xl bg-white p-4 shadow-[0_6px_24px_rgba(0,0,0,0.16)] transition ${active ? "ring-2 ring-brand" : ""}`}
            >
              <div className="flex gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl text-3xl" style={{ background: `${CATEGORY_COLOR[p.category]}22` }}>
                  {CATEGORY_EMOJI[p.category]}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-extrabold">{p.name}</h3>
                  <p className="mt-0.5 text-xs font-semibold" style={{ color: CATEGORY_COLOR[p.category] }}>
                    {p.category} · 🚶 {minutes(p)}분 · {SOLO_LABEL[p.solo_dining]}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-muted">{firstLine(p.latestComment, 70) || "아직 한마디가 없어요"}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-bold">
                <span className="rounded-full bg-surface px-2.5 py-1">👍 {p.likes}</span>
                <span className="rounded-full bg-surface px-2.5 py-1">💬 {p.comment_count}</span>
                <span className="ml-auto rounded-full bg-foreground px-3 py-1 text-white">📋 메뉴판</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
