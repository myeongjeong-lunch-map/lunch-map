"use client";

import { useState } from "react";
import { placePageUrl, type PlaceTab } from "@/lib/naverPlaceId";

const TABS: { key: PlaceTab; label: string }[] = [
  { key: "menu", label: "📋 메뉴" },
  { key: "photo", label: "📷 사진" },
  { key: "review", label: "⭐ 리뷰" },
];

type Props = {
  name: string;
  naverPlaceId: string;
  tab: PlaceTab;
  onTab: (t: PlaceTab) => void;
  onClose: () => void;
};

// 메뉴판·사진·리뷰는 저장하지 않고 네이버 플레이스 페이지를 띄워서 보여 준다 (docs/adr/0002)
export function NaverPlacePanel({ name, naverPlaceId, tab, onTab, onClose }: Props) {
  const src = placePageUrl(naverPlaceId, tab);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <button onClick={onClose} className="shrink-0 rounded-full px-2 py-1 text-sm font-semibold text-muted hover:bg-surface hover:text-foreground">
          ← 가게 카드로
        </button>
        <span className="min-w-0 flex-1 truncate text-right text-sm font-bold">{name}</span>
      </div>
      <div className="flex gap-1 border-b border-line px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            className={`flex-1 rounded-lg py-2 text-sm font-bold ${tab === t.key ? "bg-foreground text-background" : "text-foreground hover:bg-surface"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        {loadedSrc !== src && <p className="absolute inset-x-0 top-10 text-center text-sm text-muted">네이버에서 불러오는 중…</p>}
        {/* sandbox: 네이버 페이지가 바깥 창(우리 앱)을 네이버로 이동시키지 못하게 막는다. allow-top-navigation은 일부러 뺐다 */}
        <iframe
          key={src}
          src={src}
          title={`${name} 네이버 플레이스`}
          onLoad={() => setLoadedSrc(src)}
          className="relative h-full w-full border-0"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        />
      </div>
      <a href={src} target="_blank" rel="noreferrer" className="border-t border-line py-2.5 text-center text-sm font-semibold text-brand hover:bg-surface">
        화면이 안 보이면 네이버에서 열기 ↗
      </a>
    </div>
  );
}
