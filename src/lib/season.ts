// 계절 테마: 해마다 11월은 늦가을, 12~2월은 겨울 꾸미기를 켠다. 꾸미기만 하고 기능은 바꾸지 않는다.
// 날짜는 한국 시간으로 본다. 할로윈 같은 이벤트 기간에는 이벤트 테마가 먼저다 (LunchMap).

export type Season = "autumn" | "winter";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function seasonAt(now = Date.now()): Season | null {
  const month = new Date(now + KST_OFFSET_MS).getUTCMonth() + 1;
  if (month === 11) return "autumn";
  if (month === 12 || month <= 2) return "winter";
  return null;
}

export const SEASON_DECOR: Record<Season, { tagline: string; particles: string[] }> = {
  autumn: { tagline: "🍂 AUTUMN LUNCH", particles: ["🍂", "🍁"] },
  winter: { tagline: "❄️ WINTER LUNCH", particles: ["❄️", "❅", "❆"] },
};
