import type { StallKind } from "@/lib/domain";

// 제보 종류 아이콘 (#31, 시안 C "스티커": 색면 + 진한 테두리). 붕어빵·호떡은 유니코드 이모지가 없어 직접 그렸다.
// 지도 마커(HTML 문자열)와 화면(React) 둘 다 이 문자열을 쓴다. 바깥 입력이 들어가지 않는 고정 SVG다.

const INK = "#2b2118";
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
const D = `fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"`;

const SHAPES: Record<StallKind, string> = {
  bungeoppang: `<path ${S} fill="#e3a14a" d="M8 33c4-12 20-17 33-11 3 1 6 3 8 5l9-8c1 8 1 19 0 27l-9-8c-2 2-5 4-8 5-13 6-29 2-33-10z"/>
<circle cx="18" cy="30" r="2.6" fill="${INK}"/>
<path ${D} d="M27 26c3 2.5 3 7 0 9.5M34 25c3.4 3 3.4 8.5 0 11.5M41 27c2.6 2.4 2.6 6.6 0 9"/>
<path ${D} d="M24 21c4-5 10-6 15-3"/>`,
  hotteok: `<ellipse ${S} fill="#d99a45" cx="32" cy="36" rx="25" ry="15"/>
<ellipse fill="#f0bd6a" cx="32" cy="32" rx="18" ry="9"/>
<path ${D} d="M20 33c5 3 19 3 24 0"/>
<circle cx="26" cy="29" r="1.6" fill="#7a3e12"/><circle cx="33" cy="27.5" r="1.6" fill="#7a3e12"/><circle cx="39" cy="30" r="1.6" fill="#7a3e12"/>
<path ${D} d="M44 41c3 2 6 2 8 1"/>`,
  goguma: `<path ${S} fill="#8e3f73" d="M12 44c-4-10 6-24 20-30 9-4 19-2 20 6 1 6-4 11-8 14-8 7-18 14-26 13-3 0-5-1-6-3z"/>
<path stroke="${INK}" stroke-width="2" stroke-linejoin="round" fill="#f4bf4f" d="M40 18c5-1 10 0 11 5 1 4-2 8-6 10-3-4-5-10-5-15z"/>
<path ${D} d="M22 10c-2-3 0-5 2-7M30 8c-2-3 0-5 2-7"/>
<path ${D} d="M20 38c3-4 7-7 11-9"/>`,
  gunbam: `<path ${S} fill="#7b4a2a" d="M32 10c11 7 19 19 17 30-2 9-10 14-17 14s-15-5-17-14c-2-11 6-23 17-30z"/>
<path stroke="${INK}" stroke-width="2" stroke-linejoin="round" fill="#e2bd86" d="M17 42c4 7 9 10 15 10s11-3 15-10c-5 2-10 3-15 3s-10-1-15-3z"/>
<path ${D} d="M28 22l8 8M36 22l-8 8"/>
<path ${D} d="M32 10v-4"/>`,
  eomuk: `<path fill="none" stroke="#a77a4a" stroke-width="3" stroke-linecap="round" d="M32 4v56"/>
<path ${S} fill="#efcf8f" d="M18 12c9-4 19-4 28 0-2 4-2 6 0 9-9 4-19 4-28 0 2-3 2-5 0-9z"/>
<path ${S} fill="#e8c27c" d="M18 25c9-4 19-4 28 0-2 4-2 6 0 9-9 4-19 4-28 0 2-3 2-5 0-9z"/>
<rect ${S} fill="#e2453c" x="22" y="40" width="20" height="8" rx="4"/>
<rect ${S} fill="#e2453c" x="22" y="50" width="20" height="8" rx="4"/>`,
  truck: `<rect ${S} fill="#3b82f6" x="6" y="20" width="36" height="26" rx="3"/>
<path ${S} fill="#60a5fa" d="M42 28h9l7 9v9H42z"/>
<path stroke="${INK}" stroke-width="2" stroke-linejoin="round" fill="#ffd166" d="M9 20l3-7h24l3 7z"/>
<rect stroke="${INK}" stroke-width="2" fill="#e0f2fe" x="11" y="25" width="24" height="10" rx="1.5"/>
<circle ${S} fill="${INK}" cx="16" cy="48" r="5"/><circle ${S} fill="${INK}" cx="48" cy="48" r="5"/>`,
  etc: `<path ${S} fill="#a5a8b4" d="M10 22c0-6 4-10 10-10h24c6 0 10 4 10 10v14c0 6-4 10-10 10H28l-10 8v-8c-5 0-8-4-8-10z"/>
<circle cx="22" cy="29" r="2.4" fill="${INK}"/><circle cx="32" cy="29" r="2.4" fill="${INK}"/><circle cx="42" cy="29" r="2.4" fill="${INK}"/>`,
};

/** 제보 종류 아이콘 SVG 문자열 */
export function stallIconSvg(kind: StallKind, size = 24): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${SHAPES[kind]}</svg>`;
}
