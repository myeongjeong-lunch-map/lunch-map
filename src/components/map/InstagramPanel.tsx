"use client";

import { useState } from "react";
import { instagramUrl } from "@/lib/domain";

type Props = {
  name: string;
  handle: string;
  onClose: () => void;
};

// 인스타 오늘의 메뉴: 네이버 메뉴판·사진처럼 PC는 오른쪽 패널, 휴대폰은 전체 화면에 인스타그램 프로필 임베드를 띄운다.
// 프로필 임베드(instagram.com/<id>/embed/)는 공식 문서에 없는 주소라 막히면 비어 보일 수 있어, 아래에 인스타그램에서 열기를 둔다.
export function InstagramPanel({ name, handle, onClose }: Props) {
  const src = `${instagramUrl(handle)}embed/`;
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <button onClick={onClose} className="shrink-0 rounded-full px-2 py-1 text-sm font-semibold text-muted hover:bg-surface hover:text-foreground">
          ← 가게 카드로
        </button>
        <span className="min-w-0 flex-1 truncate text-right text-sm font-bold">
          {name} <span className="font-semibold text-muted">@{handle}</span>
        </span>
      </div>
      <div className="relative min-h-0 flex-1 bg-white">
        {!loaded && <p className="absolute inset-x-0 top-10 text-center text-sm text-muted">인스타그램에서 불러오는 중…</p>}
        {/* sandbox: 인스타그램 페이지가 바깥 창(우리 앱)을 이동시키지 못하게 막는다 (NaverPlacePanel과 같다) */}
        <iframe
          key={src}
          src={src}
          title={`${name} 인스타그램 @${handle}`}
          onLoad={() => setLoaded(true)}
          className="relative h-full w-full border-0"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
      <a href={instagramUrl(handle)} target="_blank" rel="noreferrer" className="border-t border-line py-2.5 text-center text-sm font-semibold text-brand hover:bg-surface">
        화면이 안 보이면 인스타그램에서 열기 ↗
      </a>
    </div>
  );
}
