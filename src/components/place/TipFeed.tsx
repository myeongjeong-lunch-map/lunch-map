"use client";

import { timeAgo, type Place, type Tip } from "@/lib/domain";
import { CategoryDot, Walking } from "@/components/place/PlaceList";

// 꿀팁 피드: 모든 가게의 최근 꿀팁. 누르면 그 가게로 간다.
export function TipFeed({ tips, places, onSelect }: { tips: Tip[] | null; places: Place[]; onSelect: (id: string) => void }) {
  const byId = new Map(places.map((p) => [p.id, p]));
  if (tips == null) return <p className="p-5 text-sm text-muted">불러오는 중…</p>;
  if (tips.length === 0) return <p className="p-8 text-center text-sm text-muted">아직 꿀팁이 없어요. 가게를 눌러 첫 꿀팁을 남겨 주세요!</p>;
  return (
    <ul className="space-y-2 px-4 pb-28">
      {tips.map((t) => {
        const p = byId.get(t.place_id);
        if (!p) return null;
        return (
          <li key={t.id}>
            <button onClick={() => onSelect(p.id)} className="w-full rounded-xl border border-line bg-surface p-3.5 text-left hover:bg-surface-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">
                <CategoryDot category={p.category} /> {p.name} · <Walking place={p} />
              </span>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{t.body}</p>
              <p className="mt-1.5 text-xs text-muted">
                {t.nickname || "익명"} · {timeAgo(t.created_at)}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
