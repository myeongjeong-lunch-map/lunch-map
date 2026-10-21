"use client";

// PROTOTYPE (throwaway): UI 시안 전환 바. 개발 환경에서만 보인다.
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export type VariantMeta = { key: string; name: string };

export function PrototypeSwitcher({ variants, current }: { variants: VariantMeta[]; current: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const idx = Math.max(0, variants.findIndex((v) => v.key === current));

  const go = (delta: number) => {
    const next = variants[(idx + delta + variants.length) % variants.length];
    const sp = new URLSearchParams(params.toString());
    sp.set("variant", next.key);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable]") || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed bottom-4 left-1/2 z-[2000] flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-600 px-2 py-1.5 text-sm font-bold text-white shadow-2xl ring-4 ring-fuchsia-300/60">
      <button onClick={() => go(-1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/20" aria-label="이전 시안">
        ←
      </button>
      <span className="min-w-40 text-center">
        PROTOTYPE {variants[idx].key} · {variants[idx].name}
      </span>
      <button onClick={() => go(1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/20" aria-label="다음 시안">
        →
      </button>
    </div>
  );
}
