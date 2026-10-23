"use client";

import { ranking, type Place, type RankingPeriod } from "@/lib/domain";
import { CategoryDot, Walking } from "@/components/place/PlaceList";

type Props = {
  places: Place[];
  period: RankingPeriod;
  onPeriod: (p: RankingPeriod) => void;
  onSelect: (id: string) => void;
  /** 할로윈 이벤트 기간이면 "🎃 할로윈" 순위(이벤트 꿀팁 수)를 더한다 */
  halloween?: boolean;
};

// 랭킹: "이번 주"는 최근 7일 좋아요·꿀팁, "전체"는 좋아요 − 싫어요. 이번 주 기록이 없으면 전체를 보여 준다.
export function RankingList({ places, period, onPeriod, onSelect, halloween = false }: Props) {
  const { ranked, fellBack, period: effective } = ranking(places, period === "halloween" && !halloween ? "week" : period);

  return (
    <ol className="px-3 pb-28">
      <li className="flex items-center gap-2 px-2 pb-2">
        <div className="flex rounded-full bg-surface p-0.5 text-xs font-bold">
          {[...(halloween ? ([["halloween", "🎃 할로윈"]] as const) : []), ["week", "이번 주"] as const, ["all", "전체"] as const].map(([k, l]) => (
            <button key={k} onClick={() => onPeriod(k)} className={`rounded-full px-3 py-1 ${period === k ? "bg-foreground text-background" : "text-muted"}`}>
              {l}
            </button>
          ))}
        </div>
        {fellBack && <span className="text-[11px] text-muted">이번 주 기록이 없어 전체 순위를 보여 줘요</span>}
        {effective === "halloween" && <span className="text-[11px] text-muted">이벤트 기간 꿀팁이 많은 가게 순</span>}
      </li>
      {ranked.map((p, i) => (
        <li key={p.id}>
          <button onClick={() => onSelect(p.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface">
            <span className={`w-8 text-center text-xl font-black ${i < 3 ? "text-gold" : "text-muted/50"}`}>{i + 1}</span>
            <CategoryDot category={p.category} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{p.name}</span>
              <span className="block text-xs text-muted">
                {p.category} · <Walking place={p} />
              </span>
            </span>
            {effective === "halloween" ? (
              <span className="text-right text-xs font-bold leading-5 text-muted">{p.event_tips ? `🎃 꿀팁 ${p.event_tips}` : "👻 유령"}</span>
            ) : (
              <span className="text-right text-xs font-bold leading-5 text-muted">
                👍 {p.likes}
                <br />
                💡 {p.tip_count}
              </span>
            )}
          </button>
        </li>
      ))}
    </ol>
  );
}
