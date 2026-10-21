import "server-only";

export type SearchResult = {
  name: string;
  roadAddress: string;
  naverCategory: string;
  lat: number;
  lng: number;
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// NAVER API HUB 지역 검색. mapx/mapy는 WGS84 좌표에 10^7을 곱한 정수 문자열이다.
export async function searchLocal(query: string): Promise<SearchResult[]> {
  const url = `https://naverapihub.apigw.ntruss.com/search/v1/local?query=${encodeURIComponent(query)}&display=5`;
  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_SEARCH_CLIENT_ID ?? "",
      "X-NCP-APIGW-API-KEY": process.env.NAVER_SEARCH_CLIENT_SECRET ?? "",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`네이버 검색 실패 (${res.status})`);
  const json = (await res.json()) as {
    items: { title: string; roadAddress: string; address: string; category: string; mapx: string; mapy: string }[];
  };
  return json.items.map((it) => ({
    name: stripTags(it.title),
    roadAddress: it.roadAddress || it.address,
    naverCategory: it.category,
    lng: Number(it.mapx) / 1e7,
    lat: Number(it.mapy) / 1e7,
  }));
}

// 네이버 Maps Reverse Geocoding: 좌표 → 도로명 주소 (없으면 지번 주소)
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&orders=roadaddr,addr&output=json`;
  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": process.env.NEXT_PUBLIC_NCP_MAPS_CLIENT_ID ?? "",
      "X-NCP-APIGW-API-KEY": process.env.NCP_MAPS_CLIENT_SECRET ?? "",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  type Region = { area1: { name: string }; area2: { name: string }; area3: { name: string } };
  type Result = {
    name: "roadaddr" | "addr";
    region: Region;
    land?: { name?: string; number1?: string; number2?: string; addition0?: { value?: string } };
  };
  const json = (await res.json()) as { results?: Result[] };
  const results = json.results ?? [];
  const road = results.find((r) => r.name === "roadaddr");
  const lot = results.find((r) => r.name === "addr");
  const r = road ?? lot;
  if (!r) return null;
  const area = `${r.region.area1.name} ${r.region.area2.name}`;
  if (road && road.land) {
    const num = [road.land.number1, road.land.number2].filter(Boolean).join("-");
    const building = road.land.addition0?.value ? ` ${road.land.addition0.value}` : "";
    return `${area} ${road.land.name ?? ""} ${num}${building}`.replace(/\s+/g, " ").trim();
  }
  const num = [r.land?.number1, r.land?.number2].filter(Boolean).join("-");
  return `${area} ${r.region.area3.name} ${num}`.replace(/\s+/g, " ").trim();
}
