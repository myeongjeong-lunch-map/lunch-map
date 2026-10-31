"use client";

import { useEffect, useRef, useState } from "react";
import { CAMPUS, WALK_KIND_EMOJI, type Place, type WalkSpot } from "@/lib/domain";
import { CATEGORY_EMOJI } from "@/components/place/categoryStyle";
import { isGhost } from "@/lib/halloween";
import { stallKindsLabel } from "@/lib/domain";
import type { StreetStall } from "@/lib/street";
import { stallIconSvg } from "@/components/street/stallIcons";
import { stallStatus } from "@/components/street/StreetPanels";
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

/**
 * 이름표끼리 겹치면 우선순위가 낮은 쪽 이름표를 숨기고 아이콘만 남긴다.
 * 캠퍼스·직접 꽂은 핀·검색 결과·선택한 핀 → 산책 장소 → 가게 → 노점 순으로 이름표를 지킨다.
 */
function declutterLabels(root: HTMLElement) {
  const items = [...root.querySelectorAll<HTMLElement>(".lm-marker, .lm-stall")];
  for (const it of items) it.classList.remove("lm-nolabel");
  const rank = (it: HTMLElement) => (it.matches(".campus, .pick, .candidate, .selected") ? 0 : it.matches(".spot") ? 1 : it.matches(".lm-marker") ? 2 : 3);
  // 멀리서 볼 때처럼 이미 이름표가 숨은 핀은 건너뛴다 (맨 앞 순위 핀은 이름표 칸이 없어도 자리를 차지한다)
  const labeled = items
    .filter((it) => rank(it) === 0 || (it.querySelector(".label")?.getClientRects().length ?? 0) > 0)
    .sort((a, b) => rank(a) - rank(b));
  const kept: DOMRect[] = [];
  for (const it of labeled) {
    const r = it.getBoundingClientRect();
    if (kept.some((k) => r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top)) it.classList.add("lm-nolabel");
    else kept.push(r);
  }
}

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

/** 장소 검색 결과 번호 핀 (①~⑤) */
function candidateIcon(name: string, index: number, chosen: boolean): string {
  return `<div class="lm-marker candidate${chosen ? " selected" : ""}"><span class="emoji num">${index + 1}</span><span class="label">${escapeHtml(name)}</span></div>`;
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
  /** 가게 추가: 장소 검색 결과. 번호 핀 ①~⑤로 찍고, 그동안 등록된 가게 핀은 흐리게 한다 */
  candidates?: { name: string; lat: number; lng: number }[] | null;
  /** 고른 검색 결과 번호(0부터) */
  chosenCandidate?: number | null;
  onPickCandidate?: (index: number) => void;
  /** 길거리 제보: 지금 보이는 노점. 가게 핀과 다른 말풍선으로 그린다 */
  stalls?: StreetStall[];
  selectedStallId?: string | null;
  onSelectStall?: (id: string) => void;
  /** 지도 아래쪽을 가리는 높이(px). 내 위치 버튼을 그 위에 둔다. 모바일 시트용 */
  coveredBottom?: number;
};

export function NaverMap({ places, spots, selectedSpotId, onSelectSpot, route, selectedId, halloween = false, onSelect, pickMode, picked, onPick, bottomInset, candidates = null, chosenCandidate = null, onPickCandidate, coveredBottom = 0, stalls = [], selectedStallId = null, onSelectStall }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const pickMarker = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const spotMarkers = useRef<Map<string, any>>(new Map());
  const stallMarkers = useRef<Map<string, any>>(new Map());
  const candidateMarkers = useRef<any[]>([]);
  const handlers = useRef({ onSelect, onSelectSpot, onPick, pickMode, bottomInset, onPickCandidate, onSelectStall });

  useEffect(() => {
    handlers.current = { onSelect, onSelectSpot, onPick, pickMode, bottomInset, onPickCandidate, onSelectStall };
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
          zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT, style: naver.maps.ZoomControlStyle.SMALL },
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
        // 확대·축소가 끝나면 핀 사이 거리가 바뀌므로 겹치는 이름표를 다시 고른다
        naver.maps.Event.addListener(m, "idle", () => el.current && declutterLabels(el.current));
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
      const toTry = !halloween && p.to_try;
      const content = `<div class="lm-marker${selected ? " selected" : ""}${ghost ? " ghost" : ""}${toTry ? " to-try" : ""}"><span class="emoji">${emoji}</span><span class="label">${escapeHtml(p.name)}</span></div>`;
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

  // 길거리 제보 노점 핀. 고정 노점은 오늘 연 것만 진하게, 아직 확인 없거나 닫았으면 흐리게
  useEffect(() => {
    const naver = window.naver;
    if (!ready || !naver?.maps || !map.current) return;
    const seen = new Set<string>();
    for (const s of stalls) {
      seen.add(s.id);
      const selected = s.id === selectedStallId;
      const dim = s.fixed && s.today !== "open";
      const content = `<div class="lm-stall${selected ? " selected" : ""}${dim ? " dim" : ""}">${stallIconSvg(s.kind, 22)}${s.kinds.length > 1 ? `<span class="more">+${s.kinds.length - 1}</span>` : ""}<span class="label">${escapeHtml(
        s.memo || stallKindsLabel(s.kinds),
      )}</span><span class="age">${escapeHtml(stallStatus(s))}</span></div>`;
      const existing = stallMarkers.current.get(s.id);
      if (existing) {
        existing.setIcon({ content });
        existing.setPosition(new naver.maps.LatLng(s.lat, s.lng));
        existing.setZIndex(selected ? 120 : 60);
      } else {
        const mk = new naver.maps.Marker({ map: map.current, position: new naver.maps.LatLng(s.lat, s.lng), icon: { content }, zIndex: selected ? 120 : 60 });
        naver.maps.Event.addListener(mk, "click", () => handlers.current.onSelectStall?.(s.id));
        stallMarkers.current.set(s.id, mk);
      }
    }
    for (const [id, mk] of stallMarkers.current) {
      if (!seen.has(id)) {
        mk.setMap(null);
        stallMarkers.current.delete(id);
      }
    }
  }, [stalls, selectedStallId, ready]);

  // 고른 노점으로 지도를 옮긴다 (모바일 시트에 가리지 않게 위로)
  useEffect(() => {
    const naver = window.naver;
    if (!ready || !naver?.maps || !map.current || !selectedStallId) return;
    const s = stalls.find((x) => x.id === selectedStallId);
    if (!s) return;
    map.current.setCenter(new naver.maps.LatLng(s.lat, s.lng));
    if (handlers.current.bottomInset) map.current.panBy(new naver.maps.Point(0, handlers.current.bottomInset / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStallId, ready]);

  // 장소 검색 결과 번호 핀
  useEffect(() => {
    const naver = window.naver;
    if (!ready || !naver?.maps || !map.current) return;
    for (const mk of candidateMarkers.current) mk.setMap(null);
    candidateMarkers.current = [];
    if (!candidates?.length) return;
    candidates.forEach((c, i) => {
      const pos = new naver.maps.LatLng(c.lat, c.lng);
      const mk = new naver.maps.Marker({
        map: map.current,
        position: pos,
        icon: { content: candidateIcon(c.name, i, false) },
        zIndex: 150,
      });
      naver.maps.Event.addListener(mk, "click", () => handlers.current.onPickCandidate?.(i));
      candidateMarkers.current.push(mk);
    });
  }, [candidates, ready]);

  // 번호 핀이 모두 보이게 지도를 맞춘다. 모바일 시트 높이가 바뀌어도 다시 맞춘다 (고른 뒤에는 고른 핀으로 옮긴다)
  useEffect(() => {
    const naver = window.naver;
    if (!ready || !naver?.maps || !map.current || !candidates?.length || chosenCandidate != null) return;
    const m = map.current;
    const bounds = new naver.maps.LatLngBounds();
    for (const c of candidates) bounds.extend(new naver.maps.LatLng(c.lat, c.lng));
    m.fitBounds(bounds, { top: 60, right: 50, bottom: 40 + bottomInset, left: 50 });
    if (m.getZoom() > LABEL_ZOOM) m.setZoom(LABEL_ZOOM);
  }, [candidates, chosenCandidate, bottomInset, ready]);

  // 고른 번호 핀을 강조하고 그 자리로 옮긴다
  useEffect(() => {
    const naver = window.naver;
    if (!ready || !naver?.maps || !map.current || !candidates) return;
    candidateMarkers.current.forEach((mk, i) => {
      mk.setIcon({ content: candidateIcon(candidates[i].name, i, i === chosenCandidate) });
      mk.setZIndex(i === chosenCandidate ? 300 : 150);
    });
    if (chosenCandidate != null && candidates[chosenCandidate]) {
      const c = candidates[chosenCandidate];
      map.current.panTo(new naver.maps.LatLng(c.lat, c.lng));
    }
  }, [chosenCandidate, candidates, ready]);

  // 내 위치 (GLOSSARY.md): 버튼을 눌렀을 때만 권한을 묻는다. 화면 표시용이고 서버로 보내지 않는다.
  const me = useRef<{ watch: number | null; dot: any; circle: any; pos: any }>({ watch: null, dot: null, circle: null, pos: null });
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const cur = me.current;
    return () => {
      if (cur.watch != null) navigator.geolocation.clearWatch(cur.watch);
    };
  }, []);

  const showMe = () => {
    const naver = window.naver;
    const m = map.current;
    if (!naver?.maps || !m) return;
    const cur = me.current;
    // 모바일 시트에 가리지 않게, 보이는 지도 영역의 가운데로 옮긴다
    const centerAbove = (pos: any) => {
      m.setCenter(pos);
      if (coveredBottom) m.panBy(new naver.maps.Point(0, coveredBottom / 2));
    };
    // 이미 켜져 있으면 내 위치로 다시 옮기기만 한다
    if (cur.watch != null) {
      if (cur.pos) centerAbove(cur.pos);
      return;
    }
    if (!("geolocation" in navigator)) {
      setNotice("이 브라우저는 위치를 지원하지 않아요.");
      return;
    }
    setLocating(true);
    let first = true;
    cur.watch = navigator.geolocation.watchPosition(
      (p) => {
        const pos = new naver.maps.LatLng(p.coords.latitude, p.coords.longitude);
        cur.pos = pos;
        if (!cur.dot) {
          cur.circle = new naver.maps.Circle({
            map: m,
            center: pos,
            radius: p.coords.accuracy,
            fillColor: "#4285f4",
            fillOpacity: 0.15,
            strokeColor: "#4285f4",
            strokeOpacity: 0.35,
            strokeWeight: 1,
            clickable: false,
          });
          cur.dot = new naver.maps.Marker({ map: m, position: pos, icon: { content: `<div class="lm-me"></div>`, anchor: new naver.maps.Point(9, 9) }, zIndex: 400, clickable: false });
        } else {
          cur.dot.setPosition(pos);
          cur.circle.setCenter(pos);
          cur.circle.setRadius(p.coords.accuracy);
        }
        // 처음 한 번만 내 위치로 옮기고, 그 뒤로는 점만 따라 움직인다
        if (first) {
          first = false;
          setLocating(false);
          centerAbove(pos);
        }
      },
      (err) => {
        if (cur.watch != null) navigator.geolocation.clearWatch(cur.watch);
        cur.watch = null;
        setLocating(false);
        setNotice(err.code === err.PERMISSION_DENIED ? "위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요." : "위치를 찾지 못했어요. 잠시 뒤 다시 눌러 주세요.");
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  };

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

  // 핀을 새로 그리면 이름표가 다시 보이므로, 그린 다음 프레임에 겹치는 이름표를 다시 숨긴다
  useEffect(() => {
    if (!ready || !el.current) return;
    const root = el.current;
    const id = requestAnimationFrame(() => declutterLabels(root));
    return () => cancelAnimationFrame(id);
  }, [places, selectedId, halloween, spots, selectedSpotId, route, stalls, selectedStallId, candidates, chosenCandidate, picked, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className={`h-full w-full ${pickMode ? "cursor-crosshair" : ""} ${candidates?.length ? "lm-dim-places" : ""}`} />
      {error && <div className="absolute inset-0 grid place-items-center bg-surface p-6 text-center text-sm text-muted">{error}</div>}
      {ready && (
        <button
          type="button"
          onClick={showMe}
          aria-label="내 위치"
          title="내 위치"
          className="absolute right-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-background text-lg shadow-[0_2px_10px_rgba(0,0,0,0.3)] transition-[bottom] duration-200"
          style={{ bottom: coveredBottom + 16 }}
        >
          <span className={locating ? "animate-pulse" : ""}>📍</span>
        </button>
      )}
      {notice && (
        <div
          className="pointer-events-none absolute left-1/2 z-10 w-max max-w-[90%] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-center text-sm font-semibold text-white shadow"
          style={{ bottom: coveredBottom + 72 }}
        >
          {notice}
        </div>
      )}
      {pickMode && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-sm font-semibold text-white shadow">
          지도에서 가게 위치를 눌러 주세요
        </div>
      )}
    </div>
  );
}
