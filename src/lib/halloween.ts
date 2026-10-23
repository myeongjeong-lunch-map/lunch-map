// 할로윈 이벤트 (10/23 ~ 10/30). 날짜가 지나면 저절로 꺼진다. 용어는 GLOSSARY.md 참고.
import type { Place, Tip } from "./domain";

export const HALLOWEEN_START = "2026-10-23T00:00:00+09:00";
export const HALLOWEEN_END = "2026-10-31T00:00:00+09:00";

export function isHalloween(now = Date.now()): boolean {
  return now >= Date.parse(HALLOWEEN_START) && now < Date.parse(HALLOWEEN_END);
}

/** 유령 가게: 이벤트 기간에 아직 아무도 꿀팁을 남기지 않은 가게. 꿀팁을 남기면 퇴치된다. */
export function isGhost(place: Pick<Place, "event_tips">): boolean {
  return place.event_tips === 0;
}

/** 가게마다 이벤트 기간의 첫 꿀팁(= 유령을 퇴치한 꿀팁) ID */
export function exorcismTipIds(tips: Tip[]): Set<string> {
  const first = new Map<string, Tip>();
  for (const t of tips) {
    if (Date.parse(t.created_at) < Date.parse(HALLOWEEN_START)) continue;
    const cur = first.get(t.place_id);
    if (!cur || Date.parse(t.created_at) < Date.parse(cur.created_at)) first.set(t.place_id, t);
  }
  return new Set([...first.values()].map((t) => t.id));
}

// 🍬 트릭 오어 트릿: 오늘 뭐 먹지? 를 돌리면 다섯 번에 한 번꼴로 트릭(장난 미션)이 나온다.
export type Trick = { emoji: string; text: string; pick?: "farthest" };

export const TRICKS: Trick[] = [
  { emoji: "👻", text: "가장 먼 가게 당첨! 산책 삼아 걸어가기", pick: "farthest" },
  { emoji: "🕯️", text: "다녀와서 꿀팁 1개 남기기 전엔 퇴근 금지" },
  { emoji: "🧟", text: "같이 간 사람이 고른 메뉴 그대로 따라 시키기" },
  { emoji: "🦇", text: "평소에 절대 안 시키는 메뉴 하나 도전" },
  { emoji: "🧙", text: "주문은 가위바위보 진 사람이 대표로" },
];

export const TRICK_CHANCE = 0.2;
