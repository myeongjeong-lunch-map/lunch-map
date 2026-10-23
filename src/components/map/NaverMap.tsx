"use client";

import { useEffect, useRef, useState } from "react";
import { CAMPUS, WALK_KIND_EMOJI, type Place, type WalkSpot } from "@/lib/domain";
import { CATEGORY_EMOJI } from "@/components/place/categoryStyle";
import { isGhost } from "@/lib/halloween";
import type { RouteLine } from "@/components/map/routeLine";

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

const LABEL_ZOOM = 18;
const ROUTE_DRAW_MS = 700;

type LngLat = [number, number];

/** 경로를 처음부터 길이 비율 t(0~1)만큼만 자른다. 마지막 점은 구간 사이를 보간한다. */
function slicePath(path: LngLat[], cum: number[], t: number): LngLat[] {
  const target = cum[cum.length - 1] * t;
  const out: LngLat[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    if (cum[i] <= target) {
      out.push(path[i]);
      continue;
    }
    const r = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    out.push([path[i - 1][0] + (path[i][0] - path[i - 1][0]) * r, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * r]);
    break;
  }
  return out;
}

function cumulative(path: LngLat[]): number[] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return cum;
}

/** 경로를 그리는 애니메이션과 가운데 칩. 지우는 함수를 돌려준다 */
function drawRoute(naver: any, m: any, path: LngLat[], opts: { dashed: boolean; chip: string | null }): () => void {
  const cum = cumulative(path);
  const toLatLngs = (pts: LngLat[]) => pts.map(([lng, lat]) => new naver.maps.LatLng(lat, lng));
  const line = new naver.maps.Polyline({
    map: m,
    path: toLatLngs(path.slice(0, 1)),
    strokeColor: "#03c75a",
    strokeWeight: 6,
    strokeOpacity: 0.9,
    strokeStyle: opts.dashed ? "shortdash" : "solid",
    strokeLineCap: "round",
    strokeLineJoin: "round",
    zIndex: 5,
  });
  let chip: any = null;
  if (opts.chip) {
    const [lng, lat] = slicePath(path, cum, 0.5).at(-1)!;
    chip = new naver.maps.Marker({
      map: m,
      position: new naver.maps.LatLng(lat, lng),
      icon: { content: `<div class="lm-route-chip">${escapeHtml(opts.chip)}</div>` },
      zIndex: 150,
      clickable: false,
    });
  }
  let frame = 0;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ROUTE_DRAW_MS);
    line.setPath(toLatLngs(slicePath(path, cum, 1 - (1 - t) ** 3)));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    line.setMap(null);
    chip?.setMap(null);
  };
}

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
  /** 산책 탭에서 지도에 찍는 산책 장소 */
  spots: WalkSpot[];
  selectedSpotId: string | null;
  onSelectSpot: (id: string) => void;
  /** 지도에 그릴 경로(가게 또는 산책). 만드는 일은 routeLine 모듈이 하고 여기서는 그리기만 한다 */
  route: RouteLine | null;
  selectedId: string | null;
  /** 할로윈 이벤트: 핀이 🎃, 유령 가게는 👻 */
  halloween?: boolean;
  onSelect: (id: string | null) => void;
  /** 가게 추가 시 핀 직접 꽂기 모드 */
  pickMode: boolean;
  picked: { lat: number; lng: number } | null;
  onPick: (p: { lat: number; lng: number }) => void;
  /** 선택한 가게로 이동할 때 화면 아래쪽을 가리는 높이(px). 모바일 시트용 */
  bottomInset: number;
};

export function NaverMap({ places, spots, selectedSpotId, onSelectSpot, route, selectedId, halloween = false, onSelect, pickMode, picked, onPick, bottomInset }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const pickMarker = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const spotMarkers = useRef<Map<string, any>>(new Map());
  const handlers = useRef({ onSelect, onSelectSpot, onPick, pickMode, bottomInset });

  useEffect(() => {
    handlers.current = { onSelect, onSelectSpot, onPick, pickMode, bottomInset };
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
      const ghost = halloween && isGhost(p);
      const emoji = halloween ? (ghost ? "👻" : "🎃") : CATEGORY_EMOJI[p.category];
      const content = `<div class="lm-marker${selected ? " selected" : ""}${ghost ? " ghost" : ""}"><span class="emoji">${emoji}</span><span class="label">${escapeHtml(p.name)}</span></div>`;
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
  }, [places, selectedId, halloween, ready]);

  // 산책 장소 마커. 지금 보는 코스 안의 장소는 이모지 자리에 순서 번호를 단다
  useEffect(() => {
    const naver = window.naver;
    if (!ready || !naver?.maps || !map.current) return;
    const order = new Map<string, number>();
    if (route?.numbered !== false) route?.stops.forEach((st, i) => order.set(`${st.lat},${st.lng}`, i + 1));
    const seen = new Set<string>();
    for (const sp of spots) {
      seen.add(sp.id);
      const selected = sp.id === selectedSpotId;
      const n = order.get(`${sp.lat},${sp.lng}`);
      const content = `<div class="lm-marker spot${selected ? " selected" : ""}"><span class="emoji">${n ?? WALK_KIND_EMOJI[sp.kind]}</span><span class="label">${escapeHtml(sp.name)}</span></div>`;
      const existing = spotMarkers.current.get(sp.id);
      if (existing) {
        existing.setIcon({ content });
        existing.setZIndex(selected ? 100 : 20);
      } else {
        const mk = new naver.maps.Marker({
          map: map.current,
          position: new naver.maps.LatLng(sp.lat, sp.lng),
          icon: { content },
          zIndex: selected ? 100 : 20,
        });
        naver.maps.Event.addListener(mk, "click", () => handlers.current.onSelectSpot(sp.id));
        spotMarkers.current.set(sp.id, mk);
      }
    }
    for (const [id, mk] of spotMarkers.current) {
      if (!seen.has(id)) {
        mk.setMap(null);
        spotMarkers.current.delete(id);
      }
    }
  }, [spots, selectedSpotId, route, ready]);

  // 산책 탭에 들어오면 캠퍼스와 모든 산책 장소가 보이게 맞춘다 (코스·장소 보기 중이면 아래 경로 효과가 맞춘다)
  const hasRoute = !!route;
  useEffect(() => {
    const naver = window.naver;
    if (!ready || !naver?.maps || !map.current || hasRoute || spots.length === 0) return;
    const campus = new naver.maps.LatLng(CAMPUS.lat, CAMPUS.lng);
    const bounds = new naver.maps.LatLngBounds(campus, campus);
    for (const sp of spots) bounds.extend(new naver.maps.LatLng(sp.lat, sp.lng));
    map.current.fitBounds(bounds, { top: 80, right: 60, bottom: 80 + handlers.current.bottomInset, left: 60 });
  }, [spots, hasRoute, ready]);

  // 경로(가게·산책 코스·산책 장소): 경로 전체가 보이게 맞추고, 초록 경로와 칩을 그린다
  useEffect(() => {
    const naver = window.naver;
    if (!ready || !naver?.maps || !map.current || !route) return;
    const m = map.current;
    const campus = new naver.maps.LatLng(CAMPUS.lat, CAMPUS.lng);
    const bounds = new naver.maps.LatLngBounds(campus, campus);
    for (const st of route.stops) bounds.extend(new naver.maps.LatLng(st.lat, st.lng));
    for (const [lng, lat] of route.path ?? []) bounds.extend(new naver.maps.LatLng(lat, lng));
    m.fitBounds(bounds, { top: 80, right: 60, bottom: 80 + handlers.current.bottomInset, left: 60 });
    if (m.getZoom() > LABEL_ZOOM) m.setZoom(LABEL_ZOOM);
    if (!route.path || route.path.length < 2) return;
    return drawRoute(naver, m, route.path, { dashed: route.dashed, chip: route.chip });
  }, [route, ready]);

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
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-sm font-semibold text-white shadow">
          지도에서 가게 위치를 눌러 주세요
        </div>
      )}
    </div>
  );
}
