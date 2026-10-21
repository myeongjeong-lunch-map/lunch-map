// 노션 "명정 캠퍼스 점심 지도" 데이터를 옮긴다.
// 사용법: node --env-file=.env.local scripts/import-notion.mjs          (검색 결과만 확인)
//        node --env-file=.env.local scripts/import-notion.mjs --write  (DB에 저장)
// 이름은 노션 표기를 그대로 쓰고, 좌표·도로명 주소는 네이버 지역 검색 첫 결과에서 가져온다.
// 비고는 그대로 꿀팁 하나가 되고, 추천 메뉴와 노션의 도보 칸은 그 뒤에 붙인다.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const CAMPUS = { lat: 37.4845457, lng: 127.0108578 };
const write = process.argv.includes("--write");
const rows = JSON.parse(readFileSync(new URL("./notion-places.json", import.meta.url), "utf8"));

async function search(query) {
  const res = await fetch(`https://naverapihub.apigw.ntruss.com/search/v1/local?query=${encodeURIComponent(query)}&display=5`, {
    headers: { "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_SEARCH_CLIENT_ID, "X-NCP-APIGW-API-KEY": process.env.NAVER_SEARCH_CLIENT_SECRET },
  });
  if (!res.ok) throw new Error(`search ${res.status}`);
  return (await res.json()).items.map((it) => ({
    title: it.title.replace(/<[^>]+>/g, ""),
    roadAddress: it.roadAddress || it.address,
    category: it.category,
    lng: Number(it.mapx) / 1e7,
    lat: Number(it.mapy) / 1e7,
  }));
}

async function walking(lat, lng) {
  const res = await fetch("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1", {
    method: "POST",
    headers: { appKey: process.env.TMAP_APP_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ startX: String(CAMPUS.lng), startY: String(CAMPUS.lat), endX: String(lng), endY: String(lat), startName: "campus", endName: "place" }),
  });
  const p = (await res.json()).features?.[0]?.properties;
  if (!res.ok || p?.totalTime == null) throw new Error(`tmap ${res.status}`);
  return { seconds: p.totalTime, meters: p.totalDistance };
}

function commentBody(r) {
  const extra = [r.menu && `추천 메뉴: ${r.menu}`, r.walk && `가는 길: ${r.walk}`].filter(Boolean).join(" / ");
  return [r.note.trim(), extra].filter(Boolean).join("\n");
}

const db = write ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null;

for (const r of rows) {
  const results = await search(r.query);
  const hit = results[0];
  if (!hit) {
    console.log(`✗ ${r.name}: 검색 결과 없음`);
    continue;
  }
  const w = await walking(hit.lat, hit.lng);
  console.log(`${write ? "→" : "?"} ${r.name}  ⇐  ${hit.title} | ${hit.roadAddress} | ${hit.category} | 도보 ${Math.round(w.seconds / 60)}분 ${w.meters}m`);
  if (!write) continue;
  const { data: place, error } = await db
    .from("places")
    .upsert(
      {
        name: r.name,
        road_address: hit.roadAddress,
        lat: hit.lat,
        lng: hit.lng,
        category: r.category,
        naver_category: hit.category,
        walking_seconds: w.seconds,
        walking_meters: w.meters,
        walking_source: "tmap",
        walking_updated_at: new Date().toISOString(),
      },
      { onConflict: "name,road_address" },
    )
    .select("id")
    .single();
  if (error) throw error;
  const body = commentBody(r);
  if (body) {
    const { count } = await db.from("tips").select("id", { count: "exact", head: true }).eq("place_id", place.id).eq("body", body);
    if (!count) {
      const { error: cErr } = await db.from("tips").insert({ place_id: place.id, body });
      if (cErr) throw cErr;
    }
  }
  // 노션의 "혼밥 가능"(가넝)은 키워드 '혼밥 OK' 1표로 옮긴다
  if (r.solo === "yes") {
    const { error: kErr } = await db.from("place_keywords").upsert({ place_id: place.id, voter_id: "notion-import", keyword: "solo" }, { onConflict: "place_id,voter_id,keyword" });
    if (kErr) throw kErr;
  }
}
