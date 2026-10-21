// 용어 정의는 GLOSSARY.md 참고.

export const CATEGORIES = ["한식", "중식", "일식", "양식", "아시안", "분식", "패스트푸드", "카페", "기타"] as const;
export type Category = (typeof CATEGORIES)[number];

export const SOLO_DINING = ["yes", "no", "unknown"] as const;
export type SoloDining = (typeof SOLO_DINING)[number];
export const SOLO_LABEL: Record<SoloDining, string> = { yes: "혼밥 가능", no: "혼밥 어려움", unknown: "혼밥 모름" };

// 캠퍼스: 서울 서초구 반포대로 45 명정빌딩 (네이버 Geocoding 결과)
export const CAMPUS = { name: "명정빌딩", lat: 37.4845457, lng: 127.0108578 };

export type Place = {
  id: string;
  name: string;
  road_address: string;
  lat: number;
  lng: number;
  category: Category;
  solo_dining: SoloDining;
  naver_category: string | null;
  naver_place_id: string | null;
  walking_seconds: number | null;
  walking_meters: number | null;
  walking_source: "tmap" | "estimate" | null;
  likes: number;
  dislikes: number;
  comment_count: number;
  created_at: string;
};

export type Comment = {
  id: string;
  place_id: string;
  nickname: string | null;
  body: string;
  created_at: string;
};

export type MyVote = 1 | -1 | 0;

export function walkingMinutes(place: Pick<Place, "walking_seconds">): number | null {
  return place.walking_seconds == null ? null : Math.max(1, Math.round(place.walking_seconds / 60));
}

// 네이버 지도에서 가게 열기. 플레이스 ID가 있으면 그 가게로 바로, 없으면 "이름 + 구"로 검색한다.
// (도로명 주소 전체를 붙이면 "…1층" 같은 꼬리 때문에 검색 결과가 없어진다)
export function naverMapUrl(place: Pick<Place, "name" | "road_address" | "naver_place_id">): string {
  if (place.naver_place_id) return `https://map.naver.com/p/entry/place/${place.naver_place_id}`;
  const district = place.road_address.split(" ").find((w) => /[구군]$/.test(w)) ?? "";
  return `https://map.naver.com/p/search/${encodeURIComponent(`${place.name} ${district}`.trim())}`;
}

// 네이버 장소 카테고리("음식점>일식>돈가스")를 우리 카테고리로 추정한다.
export function guessCategory(naverCategory: string | null | undefined): Category {
  const c = naverCategory ?? "";
  if (/카페|디저트|커피|베이커리|제과/.test(c)) return "카페";
  if (/햄버거|패스트푸드|피자|치킨/.test(c)) return "패스트푸드";
  if (/분식|김밥|떡볶이/.test(c)) return "분식";
  if (/중식|중국/.test(c)) return "중식";
  if (/일식|돈가스|돈까스|초밥|우동|라멘|일본/.test(c)) return "일식";
  if (/베트남|태국|아시아|인도|쌀국수/.test(c)) return "아시안";
  if (/양식|이탈리아|파스타|스테이크|멕시코/.test(c)) return "양식";
  if (/한식|국밥|곰탕|설렁탕|칼국수|해장국|찌개|백반|두부|한정식|뷔페/.test(c)) return "한식";
  return "기타";
}

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

export function isSoloDining(v: unknown): v is SoloDining {
  return typeof v === "string" && (SOLO_DINING as readonly string[]).includes(v);
}
