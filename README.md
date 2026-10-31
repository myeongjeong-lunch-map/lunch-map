# 🍱 명정 점심 지도

명정 캠퍼스(서울 서초구 반포대로 45 명정빌딩) 사람들이 함께 채우는 점심·카페 지도.
노션 표로 관리하던 「명정 캠퍼스 점심 지도」를 네이버 지도 위로 옮겼다.

**https://myeongjeong-lunch-map.vercel.app**

로그인 없이 링크만 있으면 누구나 보고, 가게와 꿀팁을 더할 수 있다. 구글로 로그인하면 내 기록이 기기를 바꿔도 이어진다. 용어는 [GLOSSARY.md](GLOSSARY.md)를 따른다.

## 기능

### 지도와 화면
- **네이버 지도** 위에 등록된 가게를 카테고리 이모지 핀으로 보여 준다. 캠퍼스(🏫)가 기준점이고, 충분히 확대하면 가게 이름표가 보인다
- **PC**: 왼쪽 패널 + 지도. **모바일**: 지도 + 아래에서 올라오는 시트 (작게 · 반 · 전체). 시트는 손잡이뿐 아니라 헤더·목록 어디를 잡아도 끌리고, 목록 스크롤과 이어진다
- **📍 내 위치**: 지도 오른쪽 아래 버튼을 누르면 권한을 묻고 파란 점과 정확도 원으로 보여 준다. 화면 표시용이고 서버로 보내지 않는다
- **라이트·다크 모드**: 기기 설정을 따르고, 🌙/☀️ 버튼으로 바꾼다
- **도보 시간**: 캠퍼스에서 걸어가는 시간·거리를 TMAP 실제 보행 경로로 매일 다시 계산한다 ([ADR 0001](docs/adr/0001-walking-time-daily-refresh.md)). 가게를 고르면 지도에 캠퍼스 → 가게 보행 경로선이 그려진다

### 탭
| 탭 | 하는 일 |
|---|---|
| 🏆 랭킹 | **이번 주**(최근 7일 좋아요 × 2 + 꿀팁) / **전체**(좋아요 − 싫어요). 이번 주 기록이 없으면 전체를 보여 준다 |
| 📍 목록 | 카테고리(여러 개 중 하나라도), 키워드(모두 가진 가게), 최대 도보 시간, 이름으로 거른다 |
| 💡 꿀팁 | 모든 가게의 최근 꿀팁 피드. 누르면 그 가게로 간다 |
| 🎟️ 추첨 | 팀 추첨 (아래) |
| 🚶 산책 | 산책 장소·추천 코스·내 코스·점심 코스 (아래) |

### 가게
- **가게 카드**: 카테고리·도보 시간·주소, 👍 좋아요 / 👎 싫어요 (브라우저마다 가게당 하나, 바꾸거나 취소 가능)
- **키워드**: 😋 맛있음 · 💸 가성비 · 🍚 양 많음 · ⚡ 빨리 나옴 · 🙋 혼밥 OK · 👥 단체 OK · 🕐 웨이팅 없음 · 🥡 포장 OK 중 브라우저마다 가게당 최대 5개. 고른 사람 수를 막대로 보여 준다
- **꿀팁**: 추천 메뉴·가격·가는 길·웨이팅을 닉네임(선택)과 함께 남긴다
- **📋 메뉴판 · 📷 사진 · ⭐ 리뷰**: 네이버 플레이스 페이지를 앱 안에 띄운다 ([ADR 0002](docs/adr/0002-menu-photos-via-embedded-naver-place.md)). 네이버와 연결되지 않은 가게는 새 창으로 연다
- **📷 인스타 오늘의 메뉴**: 오늘의 메뉴를 인스타그램에 올리는 가게는 누구나 계정을 등록해 둘 수 있다. 「📷 인스타 오늘의 메뉴」를 누르면 네이버 메뉴판처럼 PC는 오른쪽 패널, 휴대폰은 전체 화면에 그 계정의 최근 게시물을 띄운다(인스타그램 프로필 임베드라 막히면 비어 보일 수 있어 인스타그램에서 열기를 같이 둔다)
- **🔍 가게 검색 · 가게 추가** (누구나): 위쪽 「🔍 가게 검색」에서 네이버 장소를 찾는다. 그대로 검색과 캠퍼스 근처 동네(서초·반포·방배·양재)를 붙인 검색을 합쳐 캠퍼스에서 가까운 순으로 5곳을 보여 주고, 3km보다 먼 곳은 흐리게 표시한다. 결과를 지도에 번호 핀 ①~⑤로 보여 주고 골라서 등록한다. 검색에 없으면 지도에 핀을 직접 꽂는다. 이름 + 도로명 주소가 같으면 이미 등록된 가게로 안내한다. 카테고리·키워드·첫 꿀팁·네이버 지도 링크를 함께 넣을 수 있다
- **👀 가 볼 곳**: 가게를 추가할 때 "아직 안 가 봤어요"를 고르면 지나가다 본, 아직 아무도 안 가 본 가게로 등록된다 (키워드·첫 꿀팁 없이). 지도에서 점선 테두리 핀으로 보이고, 랭킹·🎲 오늘 뭐 먹지?·점심 코스 추천에서 빠진다(직접 후보로 담거나 추첨통에 넣는 건 된다). 누가 다녀와서 첫 꿀팁을 남기면 정식 가게가 된다

### 오늘 뭐 먹지
- **🎲 오늘 뭐 먹지?**: 지금 목록 필터 안에서 한 곳을 무작위로 고른다
- **후보 담기**: 가게 카드에서 후보로 담아 두면 그 후보 안에서만 고른다 (이 브라우저에만 기억)

### 🎟️ 추첨 (팀)
- **팀**: 누구나 만들고 닉네임으로 들어간다. 초대 링크(`/?team=…`)로 바로 들어올 수 있다. 팀을 만든 사람이 **조장**
- **추첨통**: 조장이 열고 한 사람이 넣을 수 있는 횟수(1~3번)를 정한다. 팀원이 가게를 넣고, 많이 넣은 가게일수록 잘 뽑힌다. 들어 있는 가게·넣은 횟수·확률·넣은 사람을 팀원 모두가 본다
- **추첨 연출**: 🏇 경주 · 🎯 플링코 (할로윈 기간에는 🧙 마녀의 솥). 결과는 서버가 정한다 ([ADR 0004](docs/adr/0004-draw-result-decided-by-server.md))
- **다시 뽑기 · 결정**: 마음에 안 들면 조장이 앞 회차에 뽑힌 가게를 빼고 다시 뽑는다. "이걸로 결정"을 누르면 추첨통이 닫히고 **추첨 기록**에 남는다

### 🚶 산책
- **산책 장소**: 예술의전당·국립국악원·서리풀공원 등 점심 뒤 걸어서 들를 곳
- **추천 코스 · 내 코스**: 캠퍼스 → 장소들 → 캠퍼스. **코스 시간** = 구간별 걷는 시간(TMAP) + 둘러보는 시간 ([ADR 0005](docs/adr/0005-walk-course-time-from-daily-legs.md))
- **점심 코스**: 가게 한 곳 + 산책 장소 한 곳. **먹고 걷기** / **포장해서 먹기**, 점심시간(12:50~14:00) 안에 돌아오는 것만, **복귀 시각**을 크게 보여 준다. 앱으로 **미리 주문**하는 가게는 기다리는 시간을 짧게 잡는다 ([ADR 0006](docs/adr/0006-place-legs-bounded-then-computed.md))

### 🐟 길거리 제보
- 지나가다 본 **붕어빵·호떡·군고구마·군밤·어묵·떡볶이·푸드트럭** 노점을 📍 내 위치(또는 지도에서 골라)로 제보한다. 같이 파는 종류는 최대 3개까지 고르고, 처음 고른 것이 지도 아이콘이 된다. 캠퍼스에서 2km 안, 한 줄 메모·닉네임(선택)
- **일일 노점**(오늘 본 곳): 마지막 확인 뒤 6시간 보이고 매일 05:00에 정리. "아직 있어요"로 연장, "없어졌어요" 2번(제보한 사람은 1번)이면 내려간다
- **고정 노점**(매일 나오는 곳): 사라지지 않고 "오늘 열었어요 / 오늘은 안 열었어요 / 이제 안 나와요"로 확인. 오늘 연 곳만 지도에 진하게. 14일 동안 확인이 없거나 "이제 안 나와요" 2번이면 내려간다. 일일 노점은 누구나 고정 노점으로 바꿀 수 있다
- 30m 안에 종류가 하나라도 겹치는 제보가 있으면 새로 올리기 전에 그 노점인지 묻는다 ([ADR 0007](docs/adr/0007-street-sightings-without-stall-registry.md))
- 지도에는 어느 탭에서든 노점 핀(스티커 아이콘 말풍선)이 보이고, 패널의 **지금 길거리 n곳**에서 목록을 본다

### 👤 나 (로그인과 개인화)
- 위쪽 👤 버튼: **구글로 로그인**·로그아웃, 계정 닉네임, ⭐ 즐겨찾기, 내 기록(내 평가·내 키워드·내 꿀팁)
- 가게 카드 이름 옆 ☆를 누르면 **즐겨찾기**에 담긴다. 나에게만 보인다
- 로그인하지 않아도 모두 쓸 수 있고 이 브라우저에 남는다. 로그인하면 이 브라우저의 평가·키워드·즐겨찾기·팀원 기록을 계정으로 옮기고, 다른 기기에서도 이어진다. 계정 닉네임은 꿀팁·팀 닉네임 칸에 미리 채워진다
- 계정을 구분하는 ID와 직접 정한 닉네임만 저장하고, 이메일·이름·사진은 쓰지 않는다 ([ADR 0008](docs/adr/0008-google-login-with-supabase-auth.md))

### 관리자 (`/admin`)
- `ADMIN_SECRET`으로 로그인해 가게 이름·카테고리·네이버 링크를 고치거나 가게·꿀팁을 지운다

### 기간 이벤트
- **🎃 할로윈 (10/23~10/30)**: 주황·보라 테마, 🎃 핀, Trick or Treat(오늘 뭐 먹지에 장난 미션), 👻 유령 가게 퇴치(이벤트 기간 꿀팁이 없는 가게), 🧙 마녀의 솥 추첨, 🎃 할로윈 랭킹. 날짜가 지나면 저절로 꺼진다
- **🍂 늦가을 (11월) · ❄️ 겨울 (12~2월)**: 해마다 날짜를 보고 저절로 켜지는 꾸미기. 단풍색·겨울색 테마와 지도 위로 떨어지는 낙엽·눈송이(움직임 줄이기 설정이면 숨김). 기능은 바꾸지 않는다 ([src/lib/season.ts](src/lib/season.ts))

### Claude와 함께 쓰기
- **MCP 서버**: Claude에서 "10분 안에 갈 수 있는 국밥집 추천해 줘"처럼 묻는다 → [Claude에 점심 지도 연결하기](#claude에-점심-지도-연결하기-mcp)
- **Claude Code mod**: `/lunch`로 옆 패널에 오늘 점심 추천과 이번 주 랭킹 → [Claude Code에 "오늘 점심" 패널 붙이기](#claude-code에-오늘-점심-패널-붙이기-mod)

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
    auth/                    구글 로그인 login·callback(기록 옮기기)·logout
    api/
      places/                가게 목록·추가, [id]/tips·vote·keywords·favorite
      me/                    내 계정(로그인 여부·닉네임), me/tips(내 꿀팁)
      teams/                 팀 목록·만들기, [id]/members·box(추첨통)·box/entries·box/draw(다시 뽑기 포함)·box/decide
      tips/                  꿀팁 피드
      search/, reverse/      네이버 장소 검색, 좌표 → 주소
      walk/                  산책 장소·코스·구간·가게 구간, path·lunch-path(구간별 보행 경로)
      cron/walking/          매일 도보 시간 재계산 (Vercel Cron)
      cron/walk-legs/        매일 산책 구간·가게 구간 재계산 (Vercel Cron)
      cron/purge-write-events/ 매일 30일 지난 남용 방지 기록(IP 해시) 삭제 (Vercel Cron)
      street/                길거리 제보: 목록·제보, [id]/check(노점 확인), [id](고정 노점으로)
      mcp/                   MCP 서버 (읽기 전용 도구 7개)
      admin/                 관리자 수정·삭제
  components/                LunchMap(전체 틀) + map/ place/ draw/ walk/ street/ me/ admin/ ui/ (기능별 폴더)
  lib/
    domain.ts                용어·타입·키워드 목록·랭킹 계산
    server/                  Supabase, 네이버, TMAP, 쓰기 방어(허니팟·속도 제한), 쿠키·로그인 세션
supabase/migrations/         DB 스키마 (순서대로 적용)
scripts/                     노션 데이터 옮기기, 플레이스 ID 채우기, Vercel 환경 변수 올리기
claude-mod/lunch-today/      Claude Code "오늘 점심" 패널 mod (.claude-plugin/marketplace.json이 설치 목록)
```

- **스택**: Next.js 16 (App Router) · Tailwind CSS 4 · Supabase(Postgres, 서울) · Vercel(서울 `icn1`)
- **외부 API**: 네이버 지도(Maps), NAVER API HUB 지역 검색, SK TMAP 보행자 경로
- 모든 DB 접근은 서버(API 라우트)에서 Supabase secret 키로만 한다. 테이블은 RLS로 직접 접근이 막혀 있다.
- 평가·키워드·즐겨찾기·팀원은 "나" ID 하나로 구분한다. 구글로 로그인했으면 계정 ID, 아니면 브라우저 쿠키(`lm_voter`)다. 로그인하면 그 브라우저의 기록을 계정으로 옮긴다 ([ADR 0008](docs/adr/0008-google-login-with-supabase-auth.md)).

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

### 로그인 설정

구글 로그인은 Supabase Auth를 쓴다. 새 환경 변수는 없고, Supabase 프로젝트마다(개발·운영 각각) 대시보드에서 한 번 설정한다.

1. Google Cloud 콘솔 → API 및 서비스 → 사용자 인증 정보 → **OAuth 클라이언트 ID**(웹 애플리케이션)를 만든다. 승인된 리디렉션 URI는 `https://<프로젝트 ref>.supabase.co/auth/v1/callback`. OAuth 동의 화면의 범위는 기본(이메일·프로필·openid)만 둔다.
2. Supabase → Authentication → Sign In / Providers → **Google**을 켜고 1번의 클라이언트 ID·시크릿을 넣는다.
3. Supabase → Authentication → URL Configuration
   - **Site URL**: 그 프로젝트의 배포 주소 (개발 DB는 dev 주소, 운영 DB는 운영 주소). 허용 목록에 맞지 않는 주소는 여기로 보내지므로 `localhost`로 두지 않는다.
   - **Redirect URLs**: `http://localhost:3000/**`와 배포 주소 + `/**` (예: `https://myeongjeong-lunch-map-dev.vercel.app/**`). 로그인은 `/auth/callback?next=…`처럼 뒤에 값을 붙여 돌아오므로 `/auth/callback`만 넣으면 맞지 않는다.

설정하지 않으면 로그인 버튼만 실패하고(👤 화면에 "로그인하지 못했어요"), 나머지 기능은 그대로 동작한다.

### 접속 통계

방문자 수·페이지 조회 수는 [Vercel Web Analytics](https://vercel.com/docs/analytics)로 본다. 코드(`src/app/layout.tsx`의 `<Analytics />`)는 들어 있고, Vercel 프로젝트마다(dev·운영 각각) 대시보드 → **Analytics** → **Enable**을 한 번 눌러야 모이기 시작한다. 쿠키를 쓰지 않으며, 모으는 항목은 개인정보처리방침(`/privacy`)에 적혀 있다.

## Claude에 점심 지도 연결하기 (MCP)

점심 지도는 MCP 서버(`/api/mcp`, Streamable HTTP, 읽기 전용, 인증 없음)를 연다. 연결하면 Claude에게 "10분 안에 갈 수 있는 국밥집 추천해 줘", "부캉팀 추첨통에 뭐 들어 있어?"처럼 물어볼 수 있다.

| 서버 | 주소 |
|---|---|
| 운영 | `https://myeongjeong-lunch-map.vercel.app/api/mcp` |
| dev | `https://myeongjeong-lunch-map-dev.vercel.app/api/mcp` |

**Claude Code** — 터미널에서 한 줄. `--scope user`를 붙이면 모든 프로젝트에서 쓴다.
```bash
claude mcp add --scope user --transport http lunch-map https://myeongjeong-lunch-map.vercel.app/api/mcp
```
`claude mcp list`에 `lunch-map … ✔ Connected`가 보이면 된다. 연결은 새로 여는 세션부터 쓸 수 있다.

**Claude 앱 · claude.ai** — 설정 → 커넥터 → **사용자 지정 커넥터 추가** → 이름 `점심 지도`, URL에 운영 주소. 대화에서 커넥터를 켜고 물어본다. (사용자 지정 커넥터는 Pro·Max·Team·Enterprise 요금제에서 된다)

**다른 MCP 클라이언트** — Streamable HTTP를 지원하면 위 주소를 그대로 넣는다. stdio만 되면 `npx -y mcp-remote <주소>`로 감싼다.

| 도구 | 하는 일 |
|---|---|
| `search_places` | 이름·카테고리·키워드·최대 도보 분으로 가게 찾기 |
| `get_place` | 가게 하나의 주소·도보 시간·평가·키워드·최근 꿀팁·네이버 지도 링크 |
| `get_ranking` | 랭킹 (이번 주 / 전체). 가 볼 곳은 빠진다 |
| `pick_lunch` | 오늘 뭐 먹지: 조건 안에서 무작위 한 곳 (가 볼 곳은 빼고) |
| `get_team_box` | 팀의 열린 추첨통: 가게·넣은 횟수·확률·넣은 사람 |
| `list_walk_courses` | 추천 산책 코스와 코스 시간 |
| `list_street_stalls` | 지금 보이는 길거리 노점 (종류로 거르기) |

도구는 [src/lib/server/mcpTools.ts](src/lib/server/mcpTools.ts)에 있다. 쓰기 도구(꿀팁·평가·추첨통 넣기)는 아직 없다.

## Claude Code에 "오늘 점심" 패널 붙이기 (mod)

[claude-mod/lunch-today](claude-mod/lunch-today)는 Claude Code 옆 패널에 **🍱 오늘 점심**을 띄우는 mod(플러그인)다. 위 MCP 서버에서 추천 한 곳과 이번 주 랭킹 3곳을 받아 보여 준다.

**설치** — Claude Code 터미널 세션의 입력창에서:
```
/plugin install lunch-today --marketplace myeongjeong-lunch-map/lunch-map
```
`Add marketplace?`에 `y`, 범위는 **user**(Enter)를 고르면 `Installed lunch-today`가 뜨고 바로 켜진다.

셸에서 한 줄로:
```bash
claude plugin install lunch-today --marketplace myeongjeong-lunch-map/lunch-map
```

데스크톱 앱(`/plugin`이 안 되는 곳): 입력창 옆 **+** → **Plugins** → **Add marketplace**에 `myeongjeong-lunch-map/lunch-map` → **Add plugin**에서 `lunch-today`.

**쓰기**
- `/lunch` — 패널을 열고 추천 한 곳 + 이번 주 랭킹을 보여 준다
- `/lunch 한식 10분`, `/lunch 분식`, `/lunch 국밥` — 카테고리, 최대 도보 분, 이름 일부로 조건을 건다
- 패널의 **🎲 다시 뽑기**(`r`), **조건 지우기**(`c`)

**참고**
- 위의 `lunch-map` MCP가 연결돼 있으면 그것으로 부르고, 없거나 막히면 같은 주소에 HTTP로 직접 요청한다. 그래서 MCP를 따로 연결하지 않아도 동작한다
- mod를 고쳐 보려면 `claude --plugin-dir claude-mod/lunch-today`로 띄우면 저장할 때마다 다시 불러온다. 고친 뒤 `claude plugin validate claude-mod/lunch-today`로 확인한다
- 업데이트: `claude plugin update lunch-today` 뒤 `/reload-plugins`

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

## Claude Code 클라우드에서 작업하기 (claude.ai/code)

내 컴퓨터를 켜 두지 않아도 [claude.ai/code](https://claude.ai/code)나 모바일 앱에서 이 저장소로 작업을 맡길 수 있다. 저장소에는 이미 준비가 되어 있고, 사람마다 **클라우드 환경을 한 번** 만들면 된다.

**저장소에 들어 있는 것**
- [.claude/settings.json](.claude/settings.json)의 SessionStart 훅이 [scripts/cloud-setup.sh](scripts/cloud-setup.sh)를 부른다. 클라우드 세션(`CLAUDE_CODE_REMOTE=true`)에서만 `npm ci`를 하고, `package-lock.json`이 그대로면 건너뛴다. 로컬에서는 아무것도 하지 않는다.
- `CLAUDE.md`, `AGENTS.md`, `.mcp.json`, 저장소 안의 `.claude/` 설정은 클라우드에서도 그대로 읽힌다. 내 컴퓨터의 `~/.claude`(개인 스킬·플러그인·메모리)는 따라가지 않는다.

**클라우드 환경 만들기** (claude.ai/code → 환경 선택 → 새 환경)
1. **이름**: `명정 점심 지도`
2. **환경 변수**: `.env.dev.shared`의 **개발용 값**을 그대로 붙여 넣는다 (`.env` 형식). 운영 키(`.env.prod.shared`, `.env.local`)는 넣지 않는다. 클라우드 세션은 개발 DB만 만진다.
3. **네트워크**: **Custom**을 고르고 "기본 허용 목록도 포함"을 켠 뒤 아래를 더한다. 기본 목록(Trusted)에는 npm·GitHub는 있지만 Supabase·네이버·TMAP은 없다.
   ```
   *.supabase.co
   *.apigw.ntruss.com
   apis.openapi.sk.com
   map.naver.com
   m.place.naver.com
   oapi.map.naver.com
   ```
4. **설정 스크립트**: 비워 둔다 (의존성은 위 훅이 설치한다).

**클라우드에서 다를 점**
- GitHub는 프록시를 거쳐 GraphQL이 막혀 `gh pr` · `gh issue`가 403이다. PR은 세션 화면의 **Create PR** 버튼으로 만들고, 이슈·담당자 지정은 `gh api`(REST)로 한다. 예: `gh api repos/myeongjeong-lunch-map/lunch-map/issues -f title=... -f body=... -f "assignees[]=bbangHo"`
- 기여 흐름(이슈 → `dev`에서 브랜치 → `dev`로 PR)은 로컬과 같다. `dev`·`master`에 직접 push하지 않는다.
- 개발 서버 화면은 클라우드에서 볼 수 없다. 화면 확인이 필요한 PR은 dev 배포나 로컬에서 확인하고, PR 테스트 칸에 "확인 못 함"으로 남긴다.
- 운영 DB 마이그레이션은 클라우드에서 하지 않는다 (지금처럼 사람이 SQL Editor에서).

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
