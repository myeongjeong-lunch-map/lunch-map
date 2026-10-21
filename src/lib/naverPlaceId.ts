// 네이버 지도/플레이스 링크에서 플레이스 ID를 뽑는다. naver.me 단축 링크는 리다이렉트를 따라간다.
// 서버와 스크립트(scripts/backfill-place-ids.mjs)가 함께 쓰므로 Node/웹 공통 API만 쓴다.

const ID_IN_PATH = /\/(?:entry\/)?(?:place|restaurant|cafe|hairshop|nailshop|hospital|accommodation)\/(\d{5,20})(?:[/?#]|$)/;

function isNaverHost(host: string): boolean {
  return host === "naver.me" || host === "naver.com" || host.endsWith(".naver.com");
}

export function placeIdFromUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!isNaverHost(url.hostname)) return null;
  const m = url.pathname.match(ID_IN_PATH);
  if (m) return m[1];
  const pin = url.searchParams.get("pinId");
  return pin && /^\d{5,20}$/.test(pin) ? pin : null;
}

export async function resolveNaverPlaceId(input: string): Promise<string | null> {
  const trimmed = input.trim();
  if (/^\d{5,20}$/.test(trimmed)) return trimmed;
  let current = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  for (let hop = 0; hop < 4; hop++) {
    const direct = placeIdFromUrl(current);
    if (direct) return direct;
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      return null;
    }
    // 단축 링크만 따라간다 (임의 주소로 요청을 보내지 않도록)
    if (url.hostname !== "naver.me") return null;
    const res = await fetch(url, { redirect: "manual", cache: "no-store" });
    const next = res.headers.get("location");
    if (!next) return null;
    current = new URL(next, url).toString();
  }
  return null;
}

export type PlaceTab = "menu" | "photo" | "review";

const TAB_PATH: Record<PlaceTab, string> = { menu: "menu/list", photo: "photo", review: "review/visitor" };

export function placePageUrl(placeId: string, tab: PlaceTab): string {
  return `https://m.place.naver.com/place/${placeId}/${TAB_PATH[tab]}`;
}
