"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DrawAnimation, Place } from "@/lib/domain";
import { CATEGORY_EMOJI } from "@/components/place/categoryStyle";

// 추첨 연출. 결과는 서버가 이미 정했고(ADR 0004), 연출은 그 결과로 끝나도록 그린다.
// 추첨통 ID를 씨앗으로 쓰므로 팀원 모두의 화면에서 같은 장면이 나온다.

export type ShowEntry = { place: Place; weight: number };

type Props = {
  animation: DrawAnimation;
  entries: ShowEntry[];
  winnerId: string;
  seed: string;
  onClose: () => void;
  onShowPlace: (id: string) => void;
};

const SLOT_COLORS = ["#03c75a", "#4361ee", "#ff6b3d", "#ff4d8d", "#fca311", "#2a9d8f", "#9b5de5", "#e5383b", "#00b4d8", "#a47148"];

function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useElapsed(): number {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setMs(now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return ms;
}

// ── 경주: 넣은 횟수(🎟)를 달고 달린다. 정해진 가게가 1등으로 들어오도록 각자의 도착 시각을 먼저 정한다.
const RACE_MS = 7000;

type Runner = { finish: number; amp: number; freq: number; phase: number };

function planRace(entries: ShowEntry[], winnerId: string, seed: string): Runner[] {
  const r = rng(seed);
  const others = entries.filter((e) => e.place.id !== winnerId).map(() => RACE_MS + 250 + r() * 1300);
  let k = 0;
  return entries.map((e) => {
    const win = e.place.id === winnerId;
    // 1등은 중간에 뒤처졌다가 막판에 치고 나온다
    return win
      ? { finish: RACE_MS, amp: -0.16, freq: 0.5, phase: 0 }
      : { finish: others[k++], amp: 0.06 + r() * 0.14, freq: 0.5 + r() * 1.2, phase: r() * Math.PI };
  });
}

function raceProgress(run: Runner, t: number): number {
  const x = Math.min(1, t / run.finish);
  const wobble = run.amp * Math.sin(Math.PI * 2 * run.freq * x + run.phase) * Math.sin(Math.PI * x);
  return Math.max(0, Math.min(1, x + wobble));
}

function Race({ entries, winnerId, seed, onEnd }: { entries: ShowEntry[]; winnerId: string; seed: string; onEnd: () => void }) {
  const [plan] = useState(() => planRace(entries, winnerId, seed));
  const t = useElapsed();
  const total = entries.reduce((s, e) => s + e.weight, 0);
  const ended = t > RACE_MS + 900;
  useEffect(() => {
    if (ended) onEnd();
  }, [ended, onEnd]);

  return (
    <div className="w-full max-w-xl space-y-2">
      {entries.map((e, i) => {
        const p = raceProgress(plan[i], t);
        return (
          <div key={e.place.id}>
            <p className="flex justify-between text-xs font-bold">
              <span className="truncate">{e.place.name}</span>
              <span className="shrink-0 text-muted">
                🎟️×{e.weight} · {Math.round((e.weight / total) * 100)}%
              </span>
            </p>
            <div className="relative mt-1 h-9 rounded-full bg-surface-2">
              <span className="absolute inset-y-0 right-3 flex items-center text-sm">🏁</span>
              <span
                className="absolute top-1/2 text-2xl"
                style={{ left: `calc(${p} * (100% - 2.5rem))`, transform: "translateY(-50%) scaleX(-1)" }}
              >
                {CATEGORY_EMOJI[e.place.category]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 플링코: 바닥 칸 너비가 넣은 횟수에 비례한다. 공이 정해진 가게 칸에 떨어지도록 경로를 먼저 정한다.
const W = 300;
const ROWS = 9;
const TOP = 30;
const GAP = 34;
const SLOT_Y = TOP + ROWS * GAP;
const H = SLOT_Y + 60;
const HOP_MS = 300;

function planPlinko(entries: ShowEntry[], winnerId: string, seed: string) {
  const r = rng(seed);
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let x = 0;
  const slots = entries.map((e, i) => {
    const w = (e.weight / total) * W;
    const slot = { ...e, x, w, color: SLOT_COLORS[i % SLOT_COLORS.length] };
    x += w;
    return slot;
  });
  const win = slots.find((s) => s.place.id === winnerId)!;
  const target = win.x + win.w * (0.3 + r() * 0.4);
  const start = W / 2 + (r() - 0.5) * 40;
  const points = [{ x: start, y: 10 }];
  for (let k = 1; k <= ROWS; k++) {
    const f = k / ROWS;
    const jitter = (r() < 0.5 ? -1 : 1) * GAP * 0.6 * (1 - f);
    points.push({ x: Math.max(8, Math.min(W - 8, start + (target - start) * f + jitter)), y: TOP + (k - 1) * GAP + GAP / 2 });
  }
  points.push({ x: target, y: SLOT_Y + 30 });
  return { slots, points };
}

function Plinko({ entries, winnerId, seed, onEnd }: { entries: ShowEntry[]; winnerId: string; seed: string; onEnd: () => void }) {
  const [plan] = useState(() => planPlinko(entries, winnerId, seed));
  const t = useElapsed();
  const { slots, points } = plan;
  const seg = Math.min(points.length - 2, Math.floor(t / HOP_MS));
  const s = Math.min(1, (t - seg * HOP_MS) / HOP_MS);
  const a = points[seg];
  const b = points[seg + 1];
  const ball = { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s * s - 14 * Math.sin(Math.PI * s) };
  const landed = t > (points.length - 1) * HOP_MS;
  const ended = t > (points.length - 1) * HOP_MS + 900;
  useEffect(() => {
    if (ended) onEnd();
  }, [ended, onEnd]);

  const pegs: { x: number; y: number }[] = [];
  for (let k = 0; k < ROWS; k++) {
    const n = k % 2 === 0 ? 9 : 8;
    const off = k % 2 === 0 ? W / 18 : W / 9;
    for (let i = 0; i < n; i++) pegs.push({ x: off + (i * W) / 9, y: TOP + k * GAP });
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[340px]">
        {pegs.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} className="fill-muted" />
        ))}
        {slots.map((sl) => (
          <g key={sl.place.id}>
            <rect
              x={sl.x + 1}
              y={SLOT_Y}
              width={Math.max(1, sl.w - 2)}
              height={56}
              rx={6}
              fill={sl.color}
              opacity={landed && sl.place.id !== winnerId ? 0.25 : 0.85}
            />
            {sl.w > 22 && (
              <text x={sl.x + sl.w / 2} y={SLOT_Y + 34} textAnchor="middle" fontSize="16">
                {CATEGORY_EMOJI[sl.place.category]}
              </text>
            )}
          </g>
        ))}
        <circle cx={ball.x} cy={ball.y} r={8} fill="#ffd166" stroke="#d99a00" strokeWidth={2} />
      </svg>
      <ul className="mt-3 grid w-full grid-cols-2 gap-x-3 gap-y-1 text-xs font-bold">
        {slots.map((sl) => (
          <li key={sl.place.id} className="flex min-w-0 items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: sl.color }} />
            <span className="truncate">{sl.place.name}</span>
            <span className="shrink-0 text-muted">🎟️×{sl.weight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DrawShow({ animation, entries, winnerId, seed, onClose, onShowPlace }: Props) {
  const [done, setDone] = useState(false);
  const onEnd = useCallback(() => setDone(true), []);
  const winner = entries.find((e) => e.place.id === winnerId)?.place;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-background/95 px-4 py-8 text-foreground backdrop-blur">
      <p className="text-sm font-bold tracking-widest text-brand">{animation === "race" ? "🏇 경주" : "🎯 플링코"} 추첨</p>
      {animation === "race" ? (
        <Race entries={entries} winnerId={winnerId} seed={seed} onEnd={onEnd} />
      ) : (
        <Plinko entries={entries} winnerId={winnerId} seed={seed} onEnd={onEnd} />
      )}
      <div className={`flex flex-col items-center gap-3 transition-opacity duration-500 ${done ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <p className="text-center text-2xl font-black">
          🎉 오늘은 {winner ? `${CATEGORY_EMOJI[winner.category]} ${winner.name}` : "삭제된 가게"}!
        </p>
        <div className="flex gap-2">
          {winner && (
            <button onClick={() => onShowPlace(winner.id)} className="rounded-xl bg-brand px-5 py-3 font-bold text-brand-ink">
              가게 보기
            </button>
          )}
          <button onClick={onClose} className="rounded-xl bg-surface-2 px-5 py-3 font-bold">
            닫기
          </button>
        </div>
      </div>
      {!done && (
        <button onClick={() => setDone(true)} className="text-xs font-bold text-muted underline">
          건너뛰기
        </button>
      )}
    </div>,
    document.body,
  );
}
