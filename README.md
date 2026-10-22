# 🍱 명정 점심 지도

명정 캠퍼스(서울 서초구 반포대로 45 명정빌딩) 사람들이 함께 채우는 점심·카페 지도.
노션 표로 관리하던 「명정 캠퍼스 점심 지도」를 네이버 지도 위로 옮겼다.

**https://myeongjeong-lunch-map.vercel.app**

- 🏆 랭킹(이번 주 / 전체), 📍 목록(카테고리·키워드·도보 시간 필터), 💡 꿀팁 피드
- 🎲 오늘 뭐 먹지? — 지금 필터 안에서 한 곳을 골라 준다
- 가게 카드: 좋아요·싫어요, 키워드(최대 5개), 꿀팁, 네이버 플레이스 메뉴판·사진·리뷰
- 로그인 없이 누구나 가게 추가 (네이버 장소 검색 또는 지도에 핀 꽂기)
- 도보 시간은 TMAP 실제 보행 경로, PC·모바일, 라이트·다크 모드

## 먼저 읽을 것

| 문서 | 내용 |
|---|---|
| [GLOSSARY.md](GLOSSARY.md) | 용어 (가게, 꿀팁, 키워드, 평가, 랭킹, 도보 시간 …). 코드와 화면 문구는 이 용어를 따른다 |
| [docs/adr/](docs/adr/) | 되돌리기 어렵거나 이유가 안 보이는 결정 (도보 시간 매일 재계산, 메뉴판을 네이버 페이지로 띄우는 이유) |
| [AGENTS.md](AGENTS.md) | Next.js 16을 쓰므로 코드를 쓰기 전에 `node_modules/next/dist/docs/`를 확인할 것 |

## 구조

```
src/
  app/
    page.tsx                 지도 화면 (LunchMap)
    admin/                   관리자 화면 (ADMIN_SECRET 로그인)
    api/
      places/                가게 목록·추가, [id]/tips·vote·keywords
      tips/                  꿀팁 피드
      search/, reverse/      네이버 장소 검색, 좌표 → 주소
      cron/walking/          매일 도보 시간 재계산 (Vercel Cron)
      admin/                 관리자 수정·삭제
  components/                LunchMap(전체 틀), NaverMap, PlaceList, RankingList, TipFeed, PlaceDetail, AddPlace …
  lib/
    domain.ts                용어·타입·키워드 목록·랭킹 계산
    server/                  Supabase, 네이버, TMAP, 쓰기 방어(허니팟·속도 제한), 쿠키
supabase/migrations/         DB 스키마 (순서대로 적용)
scripts/                     노션 데이터 옮기기, 플레이스 ID 채우기, Vercel 환경 변수 올리기
```

- **스택**: Next.js 16 (App Router) · Tailwind CSS 4 · Supabase(Postgres, 서울) · Vercel(서울 `icn1`)
- **외부 API**: 네이버 지도(Maps), NAVER API HUB 지역 검색, SK TMAP 보행자 경로
- 모든 DB 접근은 서버(API 라우트)에서 Supabase secret 키로만 한다. 테이블은 RLS로 직접 접근이 막혀 있다.
- 로그인이 없으므로 평가·키워드는 브라우저 쿠키(`lm_voter`) 하나를 한 사람으로 본다.

## 로컬에서 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기 (아래 참고)
npm run dev                  # http://localhost:3000
```

`.env.local`의 키는 **공유하지 않는다.** 둘 중 하나를 고른다.

1. **운영 키를 받아 쓰기** — 저장소 관리자에게 Vercel 팀 초대를 받은 뒤 `npx vercel link` → `npx vercel env pull .env.local`.
   운영 DB를 그대로 쓰니 시험 데이터는 꼭 지운다.
2. **내 키로 따로 쓰기** — `.env.example`의 주석대로 각 서비스에서 무료로 발급받고, 새 Supabase 프로젝트에 `supabase/migrations/`를 순서대로 실행한다.
   네이버 지도 허용 URL에 `http://localhost:3000`을 넣어야 지도가 뜬다.

## 기여하기

1. 이슈를 만들거나 기존 이슈에 손을 든다.
2. `master`에서 브랜치를 딴다 (`feat/…`, `fix/…`).
3. 올리기 전에 확인한다.
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
4. PR을 올린다. 용어가 새로 생기거나 바뀌면 [GLOSSARY.md](GLOSSARY.md)도 같이 고친다.
5. DB를 바꾸면 `supabase/migrations/`에 다음 번호로 SQL 파일을 추가한다. 이미 적용된 파일은 고치지 않는다.

`master`에 머지되면 GitHub Actions([.github/workflows/deploy.yml](.github/workflows/deploy.yml))가 타입 검사·린트 후 Vercel 운영 환경에 자동 배포한다.
Vercel Hobby 플랜은 프로젝트 주인이 아닌 사람의 커밋을 Git 연동으로 배포하지 못해서, 주인 계정 토큰(`VERCEL_TOKEN` Secret)으로 CLI 배포를 한다.

## 브랜치

- `master` — 실제 서비스 코드
- `prototype/ui-variants` — 화면 시안 A~E(버려도 되는 시안 코드). 시안 E로 결정했고 기록용으로만 둔다
