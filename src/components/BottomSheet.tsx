"use client";

import { useRef, useState, type ReactNode } from "react";

export type SheetSnap = "peek" | "half" | "full";

const HEIGHT: Record<SheetSnap, string> = { peek: "180px", half: "50dvh", full: "calc(100dvh - 48px)" };
const ORDER: SheetSnap[] = ["peek", "half", "full"];

// 네이버 지도 앱처럼 아래에서 올라오는 시트. 손잡이를 끌거나 눌러서 높이를 바꾼다.
export function BottomSheet({ snap, onSnap, children }: { snap: SheetSnap; onSnap: (s: SheetSnap) => void; children: ReactNode }) {
  const startY = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current != null) setDrag(e.clientY - startY.current);
  };
  const onPointerUp = () => {
    const idx = ORDER.indexOf(snap);
    if (Math.abs(drag) < 8) onSnap(ORDER[(idx + 1) % ORDER.length]);
    else if (drag < -40) onSnap(ORDER[Math.min(idx + 1, 2)]);
    else if (drag > 40) onSnap(ORDER[Math.max(idx - 1, 0)]);
    startY.current = null;
    setDrag(0);
  };

  return (
    <section
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"
      style={{
        height: drag ? `calc(${HEIGHT[snap]} - ${drag}px)` : HEIGHT[snap],
        transition: drag ? "none" : "height 220ms ease",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        role="button"
        aria-label="목록 높이 바꾸기"
        className="flex shrink-0 touch-none justify-center py-2.5"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="h-1.5 w-10 rounded-full bg-line" />
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
