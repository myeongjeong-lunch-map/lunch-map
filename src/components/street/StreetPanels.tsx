"use client";

import { useState } from "react";
import { api, ApiError, loadNickname, saveNickname } from "@/lib/api";
import { CAMPUS, haversine, STALL_KIND_LABEL, STALL_KINDS, timeAgo, type StallKind } from "@/lib/domain";
import { DAILY_HOURS, FIXED_DAYS, type StallCheckValue, type StreetStall } from "@/lib/street";
import { StallIcon } from "@/components/street/StallIcon";
import type { StreetStallsModule } from "@/components/street/useStreetStalls";

// 길거리 제보 화면: 지금 길거리 목록, 노점 하나, 제보하기 (GLOSSARY.md 길거리 제보·노점·노점 확인)

const field = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand";

/** 지도·목록에 붙는 짧은 상태 문구 */
export function stallStatus(s: StreetStall): string {
  if (!s.fixed) return timeAgo(s.last_seen_at);
  if (s.today === "open") return "고정 · 오늘 영업";
  if (s.today === "closed") return "고정 · 오늘 닫음";
  return `고정 · 마지막 확인 ${timeAgo(s.last_seen_at)}`;
}

function walkMinutes(s: Pick<StreetStall, "lat" | "lng">): number {
  // 보행 경로 대신 직선거리 × 1.3을 시속 4km로 (가게의 추정값과 같은 방식)
  return Math.max(1, Math.round((haversine(CAMPUS.lat, CAMPUS.lng, s.lat, s.lng) * 1.3) / 66.7));
}

/** 패널 위쪽 한 줄: 지금 길거리 n곳 + 제보 */
export function StreetBar({ count, onOpen, onReport }: { count: number; onOpen: () => void; onReport: () => void }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-bold">
        <StallIcon kind="bungeoppang" size={22} />
        <span className="truncate">{count ? `지금 길거리 ${count}곳` : "길거리 노점 제보가 아직 없어요"}</span>
        {count > 0 && <span className="shrink-0 text-xs text-muted">보기 →</span>}
      </button>
      <button onClick={onReport} className="shrink-0 rounded-full bg-foreground px-3 py-1.5 text-xs font-black text-background">
        + 제보
      </button>
    </div>
  );
}

/** 지금 길거리: 보이는 노점 목록 */
export function StreetList({
  street,
  onBack,
  onOpen,
  onReport,
}: {
  street: StreetStallsModule;
  onBack: () => void;
  onOpen: (id: string) => void;
  onReport: () => void;
}) {
  const list = street.stalls ?? [];
  return (
    <div className="px-5 pb-28 pt-1">
      <button onClick={onBack} className="text-sm font-bold text-muted hover:text-foreground">
        ← 돌아가기
      </button>
      <div className="mt-3 flex items-center justify-between">
        <h2 className="text-xl font-black">지금 길거리</h2>
        <button onClick={onReport} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-black text-background">
          + 제보
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        일일 노점은 마지막 확인 뒤 {DAILY_HOURS}시간, 고정 노점은 {FIXED_DAYS}일 동안 보여요. 지나가다 보면 확인해 주세요.
      </p>
      {street.error && <p className="mt-4 text-sm text-danger">{street.error}</p>}
      {street.stalls == null && !street.error && <p className="mt-4 text-sm text-muted">불러오는 중…</p>}
      {street.stalls?.length === 0 && <p className="mt-6 text-center text-sm text-muted">지금 보이는 노점이 없어요. 붕어빵을 보면 제보해 주세요!</p>}
      <ul className="mt-3 space-y-2">
        {list.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onOpen(s.id)}
              className={`flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:bg-surface-2 ${s.fixed && s.today !== "open" ? "opacity-60" : ""}`}
            >
              <StallIcon kind={s.kind} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  {STALL_KIND_LABEL[s.kind]}
                  {s.memo ? <span className="font-normal text-muted"> · {s.memo}</span> : null}
                </span>
                <span className="block text-xs text-muted">
                  {stallStatus(s)} · 🚶 약 {walkMinutes(s)}분
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CHECK_LABEL: Record<StallCheckValue, string> = {
  here: "👍 아직 있어요",
  gone: "👋 없어졌어요",
  open: "🟢 오늘 열었어요",
  closed: "⏸️ 오늘은 안 열었어요",
  quit: "🚫 이제 안 나와요",
};

/** 노점 하나: 상태와 노점 확인 */
export function StallDetail({ stall, street, onBack, isAdmin }: { stall: StreetStall; street: StreetStallsModule; onBack: () => void; isAdmin?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const values: StallCheckValue[] = stall.fixed ? ["open", "closed", "quit"] : ["here", "gone"];

  return (
    <div className="px-5 pb-28 pt-1">
      <button onClick={onBack} className="text-sm font-bold text-muted hover:text-foreground">
        ← 지금 길거리로
      </button>
      <div className="mt-3 flex items-center gap-3">
        <StallIcon kind={stall.kind} size={56} />
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-brand">{stall.fixed ? "고정 노점 · 매일 나오는 곳" : "일일 노점 · 오늘 본 곳"}</p>
          <h2 className="text-2xl font-black leading-tight">{STALL_KIND_LABEL[stall.kind]}</h2>
          <p className="text-sm text-muted">
            {stallStatus(stall)} · 🚶 약 {walkMinutes(stall)}분
          </p>
        </div>
      </div>
      {stall.memo && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-surface px-3 py-2.5 text-sm">{stall.memo}</p>}
      <p className="mt-2 text-xs text-muted">
        {stall.nickname || "익명"} 제보 · {timeAgo(stall.created_at)}
        {stall.fixed ? ` · 오늘 열었어요 ${stall.seen_votes}` : ` · 아직 있어요 ${stall.seen_votes}`}
        {stall.remove_votes > 0 ? ` · ${stall.fixed ? "이제 안 나와요" : "없어졌어요"} ${stall.remove_votes}` : ""}
      </p>

      <p className="mt-6 text-sm font-black">지금 어때요?</p>
      <div className={`mt-2 grid gap-2 ${values.length === 3 ? "grid-cols-1" : "grid-cols-2"}`}>
        {values.map((v) => (
          <button
            key={v}
            disabled={busy}
            onClick={() => void act(() => street.check(stall, v))}
            className={`rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 ${stall.my_check === v ? "bg-brand text-brand-ink" : "bg-surface-2 hover:bg-line"}`}
          >
            {CHECK_LABEL[v]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {stall.fixed
          ? "오늘 열었어요를 누르면 14일을 다시 채워요. 이제 안 나와요가 2번 쌓이면 내려가요."
          : `아직 있어요를 누르면 ${DAILY_HOURS}시간을 다시 채워요. 없어졌어요가 2번 쌓이면 내려가요.`}
      </p>
      {!stall.fixed && (
        <button
          disabled={busy}
          onClick={() => void act(() => street.makeFixed(stall))}
          className="mt-4 w-full rounded-xl border border-dashed border-line py-2.5 text-sm font-bold text-muted hover:bg-surface disabled:opacity-50"
        >
          📌 매일 나오는 곳이에요 (고정 노점으로)
        </button>
      )}
      {isAdmin && (
        <button
          disabled={busy}
          onClick={() =>
            void act(async () => {
              await api.adminRemoveStall(stall.id);
              await street.reload();
              onBack();
            })
          }
          className="mt-4 w-full rounded-xl bg-danger/15 py-2.5 text-sm font-bold text-danger disabled:opacity-50"
        >
          관리자: 이 제보 내리기
        </button>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

type Spot = { lat: number; lng: number; accuracy?: number };

/** 제보하기: 종류, 위치(내 위치 또는 지도), 일일·고정, 메모 */
export function ReportStall({
  street,
  picked,
  onStartPick,
  onCancel,
  onDone,
  onOpenExisting,
}: {
  street: StreetStallsModule;
  picked: { lat: number; lng: number } | null;
  onStartPick: () => void;
  onCancel: () => void;
  onDone: (id: string) => void;
  onOpenExisting: (id: string) => void;
}) {
  const [kind, setKind] = useState<StallKind | null>(null);
  const [memo, setMemo] = useState("");
  const [nickname, setNickname] = useState(loadNickname);
  const [fixed, setFixed] = useState(false);
  const [website, setWebsite] = useState("");
  const [located, setLocated] = useState<Spot | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  // 지도에서 고른 위치가 내 위치보다 나중이면 그것을 쓴다
  const [usePicked, setUsePicked] = useState(false);
  const spot: Spot | null = usePicked && picked ? picked : located;

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setError("이 브라우저는 위치를 지원하지 않아요. 지도에서 골라 주세요.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocated({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) });
        setUsePicked(false);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED ? "위치 권한이 꺼져 있어요. 지도에서 직접 골라 주세요." : "위치를 찾지 못했어요. 지도에서 직접 골라 주세요.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  const submit = async (force = false) => {
    if (!kind || !spot) return;
    setSaving(true);
    setError(null);
    try {
      const { id } = await api.reportStall({ kind, memo, nickname, fixed, lat: spot.lat, lng: spot.lng, website, force });
      saveNickname(nickname);
      await street.reload();
      onDone(id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && typeof err.data.stallId === "string") setDuplicateId(err.data.stallId);
      else setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const duplicate = duplicateId ? street.stalls?.find((s) => s.id === duplicateId) : null;

  return (
    <div className="space-y-5 px-5 pb-28 pt-1">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">길거리 제보</h2>
        <button onClick={onCancel} className="text-sm font-bold text-muted hover:text-foreground">
          취소
        </button>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-black">무엇을 봤나요?</legend>
        <div className="grid grid-cols-4 gap-2">
          {STALL_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[11px] font-bold ${kind === k.key ? "border-brand bg-brand/15" : "border-line hover:bg-surface"}`}
            >
              <StallIcon kind={k.key} size={30} />
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-black">어디서요?</legend>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="rounded-xl bg-surface-2 py-2.5 text-sm font-bold hover:bg-line disabled:opacity-50"
          >
            {locating ? "찾는 중…" : "📍 내 위치로"}
          </button>
          <button
            type="button"
            onClick={() => {
              setUsePicked(true);
              onStartPick();
            }}
            className="rounded-xl bg-surface-2 py-2.5 text-sm font-bold hover:bg-line"
          >
            🗺️ 지도에서 고르기
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {spot
            ? `위치를 정했어요${spot.accuracy ? ` (오차 약 ${spot.accuracy}m)` : ""} · 캠퍼스에서 걸어서 약 ${walkMinutes(spot)}분`
            : "지금 노점 앞이면 내 위치로, 아니면 지도에서 골라 주세요. 캠퍼스에서 2km 안만 돼요."}
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-black">어떤 노점인가요?</legend>
        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
          <button type="button" onClick={() => setFixed(false)} className={`rounded-xl py-2.5 ${!fixed ? "bg-foreground text-background" : "bg-surface-2"}`}>
            오늘 봤어요
          </button>
          <button type="button" onClick={() => setFixed(true)} className={`rounded-xl py-2.5 ${fixed ? "bg-foreground text-background" : "bg-surface-2"}`}>
            매일 나오는 곳이에요
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {fixed
            ? `고정 노점: 사라지지 않고, ${FIXED_DAYS}일 동안 아무도 "오늘 열었어요"를 안 누르면 내려가요.`
            : `일일 노점: ${DAILY_HOURS}시간 동안 보이고, 매일 새벽 5시에 정리돼요.`}
        </p>
      </fieldset>

      <div className="space-y-2">
        <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={60} placeholder="한 줄 메모 (예: 슈크림 있음, 3개 2천 원)" className={field} />
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="닉네임 (선택)" className={field} />
        {/* 봇만 채우는 숨은 칸 */}
        <input value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      </div>

      {duplicateId && (
        <div className="rounded-xl border border-brand/50 bg-brand/10 p-3 text-sm">
          <p className="font-bold">근처에 이미 {duplicate ? STALL_KIND_LABEL[duplicate.kind] : "같은"} 제보가 있어요. 이 노점인가요?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => onOpenExisting(duplicateId)} className="rounded-lg bg-brand py-2 text-sm font-bold text-brand-ink">
              맞아요, 확인하러 가기
            </button>
            <button onClick={() => void submit(true)} disabled={saving} className="rounded-lg bg-surface-2 py-2 text-sm font-bold disabled:opacity-50">
              아니요, 새로 제보
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        onClick={() => void submit()}
        disabled={!kind || !spot || saving}
        className="w-full rounded-2xl bg-brand py-3.5 text-lg font-black text-brand-ink disabled:opacity-40"
      >
        {saving ? "올리는 중…" : "제보하기"}
      </button>
    </div>
  );
}
