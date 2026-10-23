# 🍱 명정 점심 지도

명정 캠퍼스(서울 서초구 반포대로 45 명정빌딩) 사람들이 함께 채우는 점심·카페 지도.
노션 표로 관리하던 「명정 캠퍼스 점심 지도」를 네이버 지도 위로 옮겼다.

**https://myeongjeong-lunch-map.vercel.app**

- 🏆 랭킹(이번 주 / 전체), 📍 목록(카테고리·키워드·도보 시간 필터), 💡 꿀팁 피드
- 🚶 산책 — 근처 공원·예술의전당 추천 코스와 내 코스, 코스 시간(걷기 + 둘러보기), 점심 코스(먹고 걷기·포장해서 먹기, 14시 전 복귀)
- 🎲 오늘 뭐 먹지? — 지금 필터 안에서 한 곳을 골라 준다
- 🎟️ 추첨 — 팀 추첨통에 가게를 넣고(많이 넣을수록 잘 뽑힘) 조장이 경주·플링코로 추첨한다
- 가게 카드: 좋아요·싫어요, 키워드(최대 5개), 꿀팁, 네이버 플레이스 메뉴판·사진·리뷰
- 로그인 없이 누구나 가게 추가 (네이버 장소 검색 또는 지도에 핀 꽂기)
- 도보 시간은 TMAP 실제 보행 경로, PC·모바일, 라이트·다크 모드

## 먼저 읽을 것

| 문서 | 내용 |
|---|---|
| [GLOSSARY.md](GLOSSARY.md) | 용어 (가게, 꿀팁, 키워드, 평가, 랭킹, 도보 시간 …). 코드와 화면 문구는 이 용어를 따른다 |
| [docs/adr/](docs/adr/) | 되돌리기 어렵거나 이유가 안 보이는 결정 (도보 시간 매일 재계산, 메뉴판을 네이버 페이지로 띄우는 이유, 산책 코스 시간은 구간을 더해서 구함, 점심 코스의 가게 구간은 범위로 거르고 남은 쌍만 계산) |
| [AGENTS.md](AGENTS.md) | Next.js 16을 쓰므로 코드를 쓰기 전에 `node_modules/next/dist/docs/`를 확인할 것 |

## 구조

```
src/
  app/
    page.tsx                 지도 화면 (LunchMap)
    admin/                   관리자 화면 (ADMIN_SECRET 로그인)
    api/
      places/                가게 목록·추가, [id]/tips·vote·keywords
      teams/                 팀 목록·만들기, [id]/members·box(추첨통)·box/entries·box/draw(다시 뽑기 포함)·box/decide
      tips/                  꿀팁 피드
      search/, reverse/      네이버 장소 검색, 좌표 → 주소
      walk/                  산책 장소·코스·구간·가게 구간, path·lunch-path(구간별 보행 경로)
      cron/walking/          매일 도보 시간 재계산 (Vercel Cron)
      cron/walk-legs/        매일 산책 구간·가게 구간 재계산 (Vercel Cron)
      admin/                 관리자 수정·삭제
  components/                LunchMap(전체 틀) + map/ place/ draw/ walk/ admin/ ui/ (기능별 폴더)
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

## Claude에 점심 지도 연결하기 (MCP)

점심 지도는 MCP 서버(`/api/mcp`, 읽기 전용, 인증 없음)를 연다. 연결하면 Claude에게 "10분 안에 갈 수 있는 국밥집 추천해 줘"처럼 물어볼 수 있다.

- **Claude Code**
  ```bash
  claude mcp add --transport http lunch-map https://myeongjeong-lunch-map.vercel.app/api/mcp
  ```
- **Claude 앱 · claude.ai**: 설정 → 커넥터 → 사용자 지정 커넥터 추가 → URL에 `https://myeongjeong-lunch-map.vercel.app/api/mcp`
- dev 서버는 `https://myeongjeong-lunch-map-dev.vercel.app/api/mcp`

| 도구 | 하는 일 |
|---|---|
| `search_places` | 이름·카테고리·키워드·최대 도보 분으로 가게 찾기 |
| `get_place` | 가게 하나의 주소·도보 시간·평가·키워드·최근 꿀팁·네이버 지도 링크 |
| `get_ranking` | 랭킹 (이번 주 / 전체) |
| `pick_lunch` | 오늘 뭐 먹지: 조건 안에서 무작위 한 곳 |
| `get_team_box` | 팀의 열린 추첨통: 가게·넣은 횟수·확률·넣은 사람 |
| `list_walk_courses` | 추천 산책 코스와 코스 시간 |

도구는 [src/lib/server/mcpTools.ts](src/lib/server/mcpTools.ts)에 있다. 쓰기 도구(꿀팁·평가·추첨통 넣기)는 아직 없다.

## 기여하기

1. 이슈를 만들거나 기존 이슈에 손을 든다.
2. `dev`에서 이슈 번호를 넣어 브랜치를 딴다 (`feat/12-team-ranking`, `fix/…`).
3. 올리기 전에 확인한다.
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
4. `dev`로 PR을 올린다. 본문은 [PR 템플릿](.github/pull_request_template.md)의 다섯 칸(배경·의도·구현·중점 리뷰 항목·테스트)을 채우고 첫 줄에 `Closes #이슈번호`를 쓴다. Claude로 작업하면 [CLAUDE.md](CLAUDE.md)가 이 흐름을 따르게 한다. 용어가 새로 생기거나 바뀌면 [GLOSSARY.md](GLOSSARY.md)도 같이 고친다.
5. DB를 바꾸면 `supabase/migrations/`에 다음 번호로 SQL 파일을 추가한다. 이미 적용된 파일은 고치지 않는다.

`dev`에 머지되면 [deploy-dev.yml](.github/workflows/deploy-dev.yml)이 Vercel dev 프로젝트(`myeongjeong-lunch-map-dev`, 개발용 키·개발 DB)에 배포한다. dev 서버에서 확인한 뒤 `dev` → `master` PR로 운영에 낸다.
`master`에 머지되면 GitHub Actions([.github/workflows/deploy.yml](.github/workflows/deploy.yml))가 타입 검사·린트 후 Vercel 운영 환경에 자동 배포한다.
DB를 바꾸는 PR은 개발 DB에 먼저 적용하고, 운영 DB에는 `master`에 머지하기 **전에** 적용한다.
Vercel Hobby 플랜은 프로젝트 주인이 아닌 사람의 커밋을 Git 연동으로 배포하지 못해서, 주인 계정 토큰(`VERCEL_TOKEN` Secret)으로 CLI 배포를 한다.

## 개발용 MCP (Claude Code)

저장소의 [.mcp.json](.mcp.json)에 개발용 MCP 두 개가 들어 있다. Claude Code로 이 폴더를 열면 쓸지 묻는다. 키는 파일에 없고, 처음 한 번 `/mcp`에서 서버를 골라 **Authenticate**로 내 계정에 로그인한다.

| 이름 | 하는 일 | 범위 |
|---|---|---|
| `supabase-dev` | 개발 DB 테이블·데이터 조회, 마이그레이션 확인 | 개발 DB(`lunch-map-dev`)만, **읽기 전용** |
| `vercel` | 배포 상태·로그 확인, 문서 검색 | 로그인한 Vercel 계정의 권한 그대로 |

- 운영 DB는 MCP에 연결하지 않는다. 운영 DB 변경은 지금처럼 사람이 SQL Editor에서 확인하고 실행한다.
- `supabase-dev`는 개발 DB 프로젝트가 있는 Supabase 조직의 멤버여야 보인다.
- `vercel`은 Vercel 프로젝트에 접근 권한이 있는 계정이어야 배포 정보가 보인다 (Hobby 플랜은 팀원을 초대할 수 없어 지금은 프로젝트 주인만).

## 버전

[SemVer](https://semver.org/lang/ko/) `v주.부.수`를 쓴다. **운영 반영(`dev` → `master` 머지) 한 번이 버전 하나**다.

- `master`에 머지되면 [release.yml](.github/workflows/release.yml)이 지난 태그 이후 들어온 PR 브랜치 이름을 보고 다음 버전을 정해 태그와 [GitHub Release](https://github.com/myeongjeong-lunch-map/lunch-map/releases)를 만든다
  - `feat/…` PR이 하나라도 있으면 **부** (v1.1.0 → v1.2.0)
  - `fix/…` 등 그 밖의 PR만 있으면 **수** (v1.1.0 → v1.1.1)
  - **주**는 `dev` → `master` 릴리스 PR에 `release:major` 라벨을 붙였을 때만 (v1.1.0 → v2.0.0)
- 변경 기록은 GitHub Releases가 전부다. 릴리스 노트는 PR 제목으로 채워지니 PR 제목을 알아보기 쉽게 쓴다
- `package.json`의 `version`은 쓰지 않는다. 버전의 기준은 태그다

## 브랜치

- `master` — 운영 서비스 코드. 머지하면 https://myeongjeong-lunch-map.vercel.app 에 배포된다
- `dev` — 개발 서버 코드. 머지하면 https://myeongjeong-lunch-map-dev.vercel.app 에 배포된다. `dev`와 `master` 모두 PR로만 바꾼다
- `prototype/ui-variants` — 화면 시안 A~E(버려도 되는 시안 코드). 시안 E로 결정했고 기록용으로만 둔다
