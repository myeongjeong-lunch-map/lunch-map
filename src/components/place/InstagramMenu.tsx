"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { instagramUrl, type Place } from "@/lib/domain";

// 인스타 오늘의 메뉴 (GLOSSARY.md): 오늘의 메뉴를 인스타그램에 올리는 가게는 계정을 등록해 두고 바로 열어 본다.
// 「인스타 오늘의 메뉴」를 누르면 네이버 메뉴판처럼 옆 패널(휴대폰은 전체 화면)에 인스타그램 프로필 임베드를 띄운다 (InstagramPanel).
type Props = { place: Place; open: boolean; onOpen: () => void; onSaved: () => void };

export function InstagramMenu({ place, open, onOpen, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(place.instagram ?? "");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.setInstagram(place.id, value, website);
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form onSubmit={save} className="mt-2 rounded-xl bg-surface-2 p-3">
        <label className="text-xs font-bold text-muted" htmlFor="lm-instagram">
          오늘의 메뉴를 올리는 인스타그램 계정
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="lm-instagram"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="@아이디 또는 프로필 주소"
            maxLength={200}
            autoComplete="off"
            autoCapitalize="none"
            className="min-w-0 flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm"
          />
          <button disabled={saving} className="shrink-0 rounded-lg bg-foreground px-3 py-2 text-sm font-bold text-background disabled:opacity-50">
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
        <input value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        {place.instagram && <p className="mt-1.5 text-xs text-muted">비워 두고 저장하면 등록을 지워요.</p>}
        {error && <p className="mt-1.5 text-xs font-bold text-danger">{error}</p>}
        <button type="button" onClick={() => setEditing(false)} className="mt-1.5 text-xs font-bold text-muted underline">
          취소
        </button>
      </form>
    );
  }

  if (!place.instagram) {
    return (
      <button onClick={() => setEditing(true)} className="mt-2 w-full rounded-xl border border-dashed border-line py-2 text-xs font-bold text-muted hover:bg-surface-2">
        📷 인스타에 오늘의 메뉴를 올리는 가게예요? 계정 등록
      </button>
    );
  }

  return (
    <div className="mt-2">
      <button
        onClick={onOpen}
        aria-pressed={open}
        className={`w-full rounded-xl py-2.5 text-sm font-bold ${open ? "bg-foreground text-background" : "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white"}`}
      >
        📷 인스타 오늘의 메뉴
      </button>
      <p className="mt-1 flex justify-between text-xs text-muted">
        <a href={instagramUrl(place.instagram)} target="_blank" rel="noreferrer" className="font-bold underline">
          @{place.instagram} 인스타그램에서 열기 ↗
        </a>
        <button onClick={() => setEditing(true)} className="font-bold underline">
          계정 바꾸기
        </button>
      </p>
    </div>
  );
}
