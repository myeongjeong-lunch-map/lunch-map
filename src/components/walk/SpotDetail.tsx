"use client";

import { WALK_KIND_EMOJI, WALK_KIND_LABEL, campusWalk, naverMapUrl, type WalkLeg, type WalkSpot } from "@/lib/domain";

type Props = {
  spot: WalkSpot;
  legs: Map<string, WalkLeg>;
  backLabel: string;
  inDraft: boolean;
  /** 내 코스가 가득 찼으면 더 담을 수 없다 */
  draftFull: boolean;
  onToggleDraft: () => void;
  onBack: () => void;
};

export function SpotDetail({ spot, legs, backLabel, inDraft, draftFull, onToggleDraft, onBack }: Props) {
  const walk = campusWalk(spot, legs);
  return (
    <div className="px-5 pb-8 pt-1">
      <button onClick={onBack} className="py-2 text-sm font-bold text-muted hover:text-foreground">
        ← {backLabel}
      </button>
      <h2 className="text-xl font-black">
        {WALK_KIND_EMOJI[spot.kind]} {spot.name}
      </h2>
      <p className="mt-0.5 text-xs text-muted">{WALK_KIND_LABEL[spot.kind]}</p>
      {spot.summary && <p className="mt-2 text-sm">{spot.summary}</p>}
      <p className="mt-3 text-sm text-muted">
        둘러보는 시간 <b className="text-foreground">{spot.stay_minutes}분</b> · 캠퍼스에서 걸어서{" "}
        <b className="text-foreground">
          {walk.rough ? "약 " : ""}
          {walk.minutes}분
        </b>
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={onToggleDraft}
          disabled={!inDraft && draftFull}
          className={`flex-1 rounded-2xl py-3 text-sm font-black active:scale-[0.98] disabled:opacity-40 ${inDraft ? "border border-line" : "bg-brand text-brand-ink"}`}
        >
          {inDraft ? "내 코스에서 빼기" : draftFull ? "내 코스가 다 찼어요" : "내 코스에 담기"}
        </button>
        <a
          href={naverMapUrl({ name: spot.name, road_address: "서울 서초구", naver_place_id: spot.naver_place_id })}
          target="_blank"
          rel="noreferrer"
          className="grid shrink-0 place-items-center rounded-2xl border border-line px-4 text-sm font-bold hover:bg-surface"
        >
          네이버 지도
        </a>
      </div>
    </div>
  );
}
