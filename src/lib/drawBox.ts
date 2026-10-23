import { drawCandidates, drawWeights, MIN_DRAW_PLACES, type DrawEntry, type DrawResult, type TeamSummary } from "./domain";

// 추첨통 규칙 중 "지금 무엇을 할 수 있는가"를 정하는 순수 계산. 서버(src/lib/server/drawBox.ts)와 화면이 같이 쓴다.
// 서버는 이 계산으로 요청을 막고, 화면은 같은 계산으로 버튼을 켜고 끈다.

/** 첫 추첨을 한 추첨통은 더 넣거나 뺄 수 없다 (다시 뽑기의 후보가 바뀌지 않도록) */
export function isLocked(resultCount: number): boolean {
  return resultCount > 0;
}

/** 한 사람이 더 넣을 수 있는 횟수 */
export function remainingEntries(perMemberLimit: number, myEntryCount: number): number {
  return Math.max(0, perMemberLimit - myEntryCount);
}

/** 뽑을 수 없는 이유. needPlaces: 첫 추첨인데 서로 다른 가게가 모자람, onlyOneLeft: 다시 뽑는데 남은 가게가 1곳뿐 */
export type DrawBlock = "needPlaces" | "onlyOneLeft";

export type DrawBoxFacts = {
  perMemberLimit: number;
  /** 추첨통에 든 모든 항목(팀원 모두의 것) */
  entries: Pick<DrawEntry, "place_id">[];
  /** 그중 내가 넣은 횟수 */
  myEntryCount: number;
  /** 지금까지의 회차별 결과 */
  results: Pick<DrawResult, "round" | "place_id">[];
};

export type DrawBoxRules = {
  locked: boolean;
  remaining: number;
  /** 내가 넣을 수 있는가 (안 잠겼고 횟수가 남음) */
  canPut: boolean;
  /** 내가 넣은 것을 뺄 수 있는가 (안 잠겼고 넣은 게 있음) */
  canTake: boolean;
  /** 다음 추첨의 후보 항목과 그 안의 서로 다른 가게 수 */
  candidates: Pick<DrawEntry, "place_id">[];
  candidatePlaces: number;
  /** 지금 뽑을 수 없는 이유. 뽑을 수 있으면 null (조장인지는 따로 본다) */
  drawBlock: DrawBlock | null;
};

export function drawBoxRules({ perMemberLimit, entries, myEntryCount, results }: DrawBoxFacts): DrawBoxRules {
  const locked = isLocked(results.length);
  const remaining = remainingEntries(perMemberLimit, myEntryCount);
  const candidates = drawCandidates(entries, results);
  const candidatePlaces = drawWeights(candidates).length;
  return {
    locked,
    remaining,
    canPut: !locked && remaining > 0,
    canTake: !locked && myEntryCount > 0,
    candidates,
    candidatePlaces,
    drawBlock: candidatePlaces >= MIN_DRAW_PLACES ? null : locked ? "onlyOneLeft" : "needPlaces",
  };
}

/** 팀 목록 한 줄의 열린 추첨통에 가게를 더 넣을 수 있는가 */
export function canPutIntoBox(box: TeamSummary["open_box"]): boolean {
  return !!box && !box.locked && box.remaining > 0;
}

/** 팀 목록 한 줄의 추첨통이 아직 넣고 빼기를 받는가 (횟수는 따지지 않음) */
export function acceptsEntries(box: TeamSummary["open_box"]): boolean {
  return !!box && !box.locked;
}
