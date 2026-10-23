"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "lm_theme";

// layout.tsx <head>에서 첫 화면 전에 실행된다. 저장된 값이 없으면 기기 설정(CSS media query)을 따른다.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

function currentTheme(): Theme {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    mq.removeEventListener("change", cb);
    mo.disconnect();
  };
}

export function ThemeToggle() {
  // 서버에서는 테마를 모르므로 null → 빈 버튼, 브라우저에서 실제 값으로 바뀐다
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);
  const next: Theme = theme === "dark" ? "light" : "dark";

  const toggle = () => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 저장 못 해도 이번 화면에서는 바뀐다
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme ? `${next === "dark" ? "다크" : "라이트"} 모드로 바꾸기` : "테마 바꾸기"}
      title={theme ? `${next === "dark" ? "다크" : "라이트"} 모드로` : undefined}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-sm hover:bg-surface"
    >
      {theme === "dark" ? "☀️" : theme === "light" ? "🌙" : ""}
    </button>
  );
}
