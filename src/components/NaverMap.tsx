"use client";

import { useEffect, useRef, useState } from "react";
import { CAMPUS, type Category, type Place } from "@/lib/domain";

/* eslint-disable @typescript-eslint/no-explicit-any -- 네이버 지도 JS SDK는 타입 정의를 제공하지 않는다 */
declare global {
  interface Window {
    naver?: any;
    navermap_authFailure?: () => void;
  }
}

function sdkReady(): boolean {
  return !!window.naver?.maps?.Map;
}

export const CATEGORY_EMOJI: Record<Category, string> = {
  한식: "🍚",
  중식: "🥟",
  일식: "🍣",
  양식: "🍝",
  아시안: "🍜",
  분식: "🍢",
  패스트푸드: "🍔",
  카페: "☕",
  기타: "🍴",
};

const LABEL_ZOOM = 18;

let sdkPromise: Promise<any> | null = null;

function loadSdk(): Promise<any> {
  if (sdkReady()) return Promise.resolve(window.naver);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    // 네이버 지도는 인증에 실패하면 이 전역 함수를 부른다 (허용 URL 미등록 등)
    window.navermap_authFailure = () => reject(new Error("네이버 지도 인증에 실패했어요. 이 주소가 지도 API 허용 URL에 등록되어 있는지 확인해 주세요."));
    const s = document.createElement("script");
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NCP_MAPS_CLIENT_ID}`;
    s.async = true;
    s.onload = () => (sdkReady() ? resolve(window.naver) : reject(new Error("네이버 지도를 불러오지 못했어요.")));
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error("네이버 지도를 불러오지 못했어요."));
    };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type Props = {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** 가게 추가 시 핀 직접 꽂기 모드 */
  pickMode: boolean;
  picked: { lat: number; lng: number } | null;
  onPick: (p: { lat: number; lng: number }) => void;
  /** 선택한 가게로 이동할 때 화면 아래쪽을 가리는 높이(px). 모바일 시트용 */
  bottomInset: number;
};

export function NaverMap({ places, selectedId, onSelect, pickMode, picked, onPick, bottomInset }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const pickMarker = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onSelect, onPick, pickMode });

  useEffect(() => {
    handlers.current = { onSelect, onPick, pickMode };
  });

  useEffect(() => {
    let cancelled = false;
    loadSdk()
      .then((naver) => {
        if (cancelled || !el.current) return;
        const m = new naver.maps.Map(el.current, {
          center: new naver.maps.LatLng(CAMPUS.lat, CAMPUS.lng),
          zoom: 17,
          zoomControl: true,
          zoomControlOptions: { position: naver.maps.Position.RIGHT_CENTER, style: naver.maps.ZoomControlStyle.SMALL },
          scaleControl: false,
          mapDataControl: false,
        });
        new naver.maps.Marker({
          map: m,
          position: new naver.maps.LatLng(CAMPUS.lat, CAMPUS.lng),
          icon: { content: `<div class="lm-marker campus"><span class="emoji">🏫</span><span class="label">캠퍼스</span></div>` },
          zIndex: 50,
          clickable: false,
        });
        // 가게가 캠퍼스 근처에 몰려 있어서, 충분히 확대했을 때만 이름표를 보인다
        const syncLabels = () => el.current?.classList.toggle("lm-compact", m.getZoom() < LABEL_ZOOM);
        naver.maps.Event.addListener(m, "zoom_changed", syncLabels);
        syncLabels();
        naver.maps.Event.addListener(m, "click", (e: any) => {
          const h = handlers.current;
          if (h.pickMode) h.onPick({ lat: e.coord.lat(), lng: e.coord.lng() });
          else h.onSelect(null);
        });
        map.current = m;
        // 스크립트 로드 뒤에 인증 실패가 늦게 오는 경우도 안내한다
        window.navermap_authFailure = () => setError("네이버 지도 인증에 실패했어요. 이 주소가 지도 API 허용 URL에 등록되어 있는지 확인해 주세요.");
        setReady(true);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        map.current = null;
        setReady(false);
        setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 가게 마커 동기화
  useEffect(() => {
    const naver = window.naver;
    if (!ready || !naver?.maps || !map.current) return;
    const seen = new Set<string>();
    for (const p of places) {
      seen.add(p.id);
      const selected = p.id === selectedId;
      const content = `<div class="lm-marker${selected ? " selected" : ""}"><span class="emoji">${CATEGORY_EMOJI[p.category]}</span><span class="label">${escapeHtml(p.name)}</span></div>`;
      const existing = markers.current.get(p.id);
      if (existing) {
        existing.setIcon({ content });
        existing.setZIndex(selected ? 100 : 10);
      } else {
        const mk = new naver.maps.Marker({
          map: map.current,
          position: new naver.maps.LatLng(p.lat, p.lng),
          icon: { content },
          zIndex: selected ? 100 : 10,
        });
        naver.maps.Event.addListener(mk, "click", () => handlers.current.onSelect(p.id));
        markers.current.set(p.id, mk);
      }
    }
    for (const [id, mk] of markers.current) {
      if (!seen.has(id)) {
        mk.setMap(null);
        markers.current.delete(id);
      }
    }
  }, [places, selectedId, ready]);

  // 선택한 가게로 이동 (모바일 시트에 가리지 않게 위로 올린다)
  useEffect(() => {
    const naver = window.naver;
    if (!ready || !naver?.maps || !map.current || !selectedId) return;
    const p = places.find((x) => x.id === selectedId);
    if (!p) return;
    const m = map.current;
    m.panTo(new naver.maps.LatLng(p.lat, p.lng), { duration: 300 });
    if (bottomInset > 0) setTimeout(() => m.panBy(new naver.maps.Point(0, bottomInset / 2)), 320);
    // places가 바뀔 때마다 다시 움직이지 않도록 선택이 바뀔 때만 실행한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  // 핀 직접 꽂기 마커
  useEffect(() => {
    const naver = window.naver;
    if (!ready || !naver?.maps || !map.current) return;
    if (!picked) {
      pickMarker.current?.setMap(null);
      pickMarker.current = null;
      return;
    }
    const pos = new naver.maps.LatLng(picked.lat, picked.lng);
    if (!pickMarker.current) {
      pickMarker.current = new naver.maps.Marker({
        map: map.current,
        position: pos,
        icon: { content: `<div class="lm-marker pick"><span class="emoji">📍</span>여기</div>` },
        zIndex: 200,
      });
    } else {
      pickMarker.current.setPosition(pos);
    }
  }, [picked, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className={`h-full w-full ${pickMode ? "cursor-crosshair" : ""}`} />
      {error && <div className="absolute inset-0 grid place-items-center bg-surface p-6 text-center text-sm text-muted">{error}</div>}
      {pickMode && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-foreground/85 px-4 py-2 text-sm font-semibold text-white shadow">
          지도에서 가게 위치를 눌러 주세요
        </div>
      )}
    </div>
  );
}
