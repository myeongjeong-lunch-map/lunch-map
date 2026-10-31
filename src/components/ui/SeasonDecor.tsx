import { SEASON_DECOR, type Season } from "@/lib/season";

// 지도 위로 천천히 떨어지는 낙엽·눈송이. 누를 수 없고(pointer-events-none), 움직임 줄이기 설정이면 숨긴다 (globals.css).
// 위치·속도는 매번 같게 고정해 둔다 (렌더마다 바뀌지 않게).
const DROPS = [
  { left: 6, delay: 0, duration: 13, size: 16 },
  { left: 18, delay: -7, duration: 16, size: 13 },
  { left: 31, delay: -3, duration: 12, size: 18 },
  { left: 44, delay: -10, duration: 17, size: 12 },
  { left: 57, delay: -5, duration: 14, size: 15 },
  { left: 69, delay: -12, duration: 18, size: 13 },
  { left: 81, delay: -2, duration: 15, size: 17 },
  { left: 92, delay: -8, duration: 13, size: 12 },
];

export function SeasonDecor({ season }: { season: Season }) {
  const { particles } = SEASON_DECOR[season];
  return (
    <div aria-hidden className="lm-season pointer-events-none absolute inset-0 overflow-hidden">
      {DROPS.map((d, i) => (
        <span
          key={i}
          className={`lm-drop ${season}`}
          style={{ left: `${d.left}%`, fontSize: d.size, animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s` }}
        >
          {particles[i % particles.length]}
        </span>
      ))}
    </div>
  );
}
