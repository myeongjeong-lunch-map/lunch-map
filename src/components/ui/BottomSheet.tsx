"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type SheetSnap = "peek" | "half" | "full";

const HEIGHT: Record<SheetSnap, string> = { peek: "180px", half: "50dvh", full: "calc(100dvh - 48px)" };
const ORDER: SheetSnap[] = ["peek", "half", "full"];
/** 이만큼 움직이기 전에는 그냥 누른 것으로 본다 */
const SLOP = 8;

function heightPx(s: SheetSnap): number {
  const vh = window.innerHeight;
  return s === "peek" ? 180 : s === "half" ? vh * 0.5 : vh - 48;
}

/** 끌기를 놓은 높이에서 가장 가까운 단계 */
function nearestSnap(px: number): SheetSnap {
  return ORDER.reduce((best, s) => (Math.abs(heightPx(s) - px) < Math.abs(heightPx(best) - px) ? s : best));
}

/** 손가락 아래에서 세로로 스크롤되는 요소 (시트 안에서만 찾는다) */
function scrollerAt(target: EventTarget | null, root: HTMLElement): HTMLElement | null {
  for (let n = target as HTMLElement | null; n && n !== root; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

// 네이버 지도 앱처럼 아래에서 올라오는 시트.
// 손잡이뿐 아니라 시트 어디를 잡아도 끌 수 있고, 목록 스크롤과 이어진다:
// 다 올라오지 않았을 때 위로 밀면 시트가 먼저 올라가고, 목록이 맨 위일 때 아래로 당기면 시트가 내려간다.
export function BottomSheet({ snap, onSnap, children }: { snap: SheetSnap; onSnap: (s: SheetSnap) => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [drag, setDrag] = useState(0);
  const latest = useRef({ snap, onSnap });
  useEffect(() => {
    latest.current = { snap, onSnap };
  });

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let mode: "idle" | "undecided" | "sheet" | "scroll" = "idle";
    let startX = 0;
    let startY = 0;
    let dy = 0;
    let scroller: HTMLElement | null = null;
    let suppressClickUntil = 0;
    const onClick = (e: MouseEvent) => {
      if (Date.now() < suppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dy = 0;
      scroller = scrollerAt(e.target, root);
      mode = "undecided";
    };
    const onMove = (e: TouchEvent) => {
      if (mode === "idle" || mode === "scroll") return;
      const dx = e.touches[0].clientX - startX;
      dy = e.touches[0].clientY - startY;
      if (mode === "undecided") {
        if (dy === 0 && dx === 0) return;
        // 첫 움직임에서 정해야 한다. 브라우저가 스크롤을 시작한 뒤에는 막을 수 없다.
        const { snap } = latest.current;
        const sheet = Math.abs(dx) <= Math.abs(dy) && (!scroller || (dy < 0 && snap !== "full") || (dy > 0 && scroller.scrollTop <= 0));
        mode = sheet ? "sheet" : "scroll";
        if (!sheet) return;
      }
      e.preventDefault();
      setDrag(dy);
    };
    const onEnd = () => {
      if (mode === "sheet" && Math.abs(dy) >= SLOP) {
        const { snap, onSnap } = latest.current;
        let next = nearestSnap(heightPx(snap) - dy);
        // 짧게 휙 밀어도 민 방향으로 한 단계는 움직인다
        if (next === snap && Math.abs(dy) >= 40) next = ORDER[Math.max(0, Math.min(2, ORDER.indexOf(snap) + (dy < 0 ? 1 : -1)))];
        onSnap(next);
        // 끌기를 마친 손가락이 그 자리의 버튼을 누른 것으로 치지 않는다
        suppressClickUntil = Date.now() + 400;
      }
      mode = "idle";
      setDrag(0);
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", onEnd);
    root.addEventListener("click", onClick, { capture: true });
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
      root.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  // 손잡이를 누르면: 다 올라와 있으면 반으로, 아니면 한 단계 위로
  const tapHandle = () => onSnap(snap === "full" ? "half" : ORDER[ORDER.indexOf(snap) + 1]);

  return (
    <section
      ref={ref}
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.35)]"
      style={{
        height: drag ? `clamp(120px, calc(${HEIGHT[snap]} - ${drag}px), calc(100dvh - 48px))` : HEIGHT[snap],
        transition: drag ? "none" : "height 220ms ease",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <button type="button" aria-label="목록 높이 바꾸기" className="flex shrink-0 justify-center py-2.5" onClick={tapHandle}>
        <span className="h-1.5 w-10 rounded-full bg-line" />
      </button>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
