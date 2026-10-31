import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 · 명정 점심 지도",
  description: "명정 점심 지도가 어떤 정보를 왜, 얼마나 보관하는지",
};

// 개인정보처리방침. 구글 로그인 앱 게시에 필요한 공개 페이지다 (docs/adr/0008).
// 실제로 저장하는 것과 어긋나지 않게, 저장하는 칸이 바뀌면 이 페이지도 같이 고친다.
const UPDATED = "2026년 10월 31일";
const CONTACT_EMAIL = "myeongjeongLunchMap@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-foreground">
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-bold text-muted hover:text-foreground">
          ← 명정 점심 지도로
        </Link>
        <h1 className="mt-4 text-2xl font-black">개인정보처리방침</h1>
        <p className="mt-1 text-xs text-muted">시행일 {UPDATED}</p>
        <p className="mt-4 text-sm leading-relaxed text-foreground/85">
          명정 점심 지도(이하 &quot;지도&quot;)는 명정 캠퍼스 사람들이 점심 가게를 함께 채우는 비영리 지도입니다. 로그인하지 않아도 모든 기능을 쓸 수 있고,
          필요한 만큼만 보관합니다.
        </p>

        <Section title="1. 보관하는 정보">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>브라우저 ID</b>: 처음 방문하면 무작위 ID를 쿠키(<code>lm_voter</code>, 5년)에 넣어, 같은 브라우저에서 남긴 평가·키워드·즐겨찾기·노점 확인·팀원
              자격을 구분합니다. 이름이나 연락처와 연결되지 않습니다.
            </li>
            <li>
              <b>직접 남긴 내용</b>: 가게 평가(좋아요·싫어요), 키워드, 꿀팁과 그때 적은 닉네임, 즐겨찾기, 추가한 가게, 길거리 제보(노점의 위치·종류·한 줄
              메모·닉네임), 팀과 팀 닉네임, 추첨통에 넣은 가게.
            </li>
            <li>
              <b>구글 로그인을 한 경우</b>: 로그인은 Supabase Auth가 처리하며, Supabase가 계정 식별자와 구글이 넘겨준 이메일·이름·프로필 사진 주소를 보관합니다.
              지도는 이 중 계정 식별자만 쓰고, 직접 정한 계정 닉네임만 따로 저장합니다. 이메일·이름·사진은 화면에 보여 주거나 다른 곳에 쓰지 않습니다.
            </li>
            <li>
              <b>남용 방지 기록</b>: 글을 쓸 때 접속 IP를 되돌릴 수 없는 해시값으로 바꿔 시각과 함께 남기고, 짧은 시간에 너무 많이 쓰는지만 확인합니다. IP
              원문은 저장하지 않으며, 이 기록은 30일 뒤 자동으로 지웁니다.
            </li>
            <li>
              <b>접속 통계</b>: 몇 명이 어느 페이지를 보는지 알기 위해 Vercel Web Analytics로 본 페이지 주소, 들어온 경로(referrer), 국가, 브라우저·운영체제·기기
              종류를 모읍니다. 쿠키를 쓰지 않고, 같은 방문자를 구분하는 값은 하루가 지나면 버려져 누구인지 알 수 없습니다.
            </li>
            <li>
              <b>이 브라우저에만 남는 설정</b>: 화면 테마, 닉네임, 🎲 후보, 고른 팀, 내 산책 코스는 브라우저 저장소(localStorage)에만 두며 서버로 보내지
              않습니다.
            </li>
          </ul>
          <p>
            지도의 📍 내 위치는 브라우저가 알려 준 위치를 화면에 점으로 보여 주기만 하고 서버로 보내지 않습니다. 길거리 제보에서 내 위치로 제보하면 그 위치가
            노점의 위치로 저장됩니다.
          </p>
        </Section>

        <Section title="2. 쓰는 목적">
          <p>가게 지도와 랭킹, 추첨, 길거리 제보를 보여 주고, 같은 사람의 기록을 이어 주며(로그인하면 다른 기기에서도), 장난성 대량 작성을 막고, 접속 통계로 얼마나 쓰이는지 보는 데만 씁니다.</p>
          <p>광고, 판매, 프로필 분석에 쓰지 않습니다.</p>
        </Section>

        <Section title="3. 공개되는 정보">
          <p>
            꿀팁, 가게 평가 수, 키워드 수, 길거리 제보와 거기에 적은 닉네임, 팀 이름과 팀원 닉네임은 지도를 보는 사람 누구에게나 보입니다. 닉네임은 실명이
            아니어도 됩니다.
          </p>
        </Section>

        <Section title="4. 보관 기간과 삭제">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>직접 남긴 내용은 지도가 운영되는 동안 보관합니다. 평가·키워드·즐겨찾기는 언제든 취소할 수 있습니다.</li>
            <li>남용 방지 기록(IP 해시와 시각)은 30일이 지나면 매일 자동으로 지웁니다.</li>
            <li>길거리 제보는 시간이 지나거나 확인이 쌓이면 지도에서 내려가며, 기록은 남용 확인을 위해 보관합니다.</li>
            <li>브라우저 ID 쿠키는 브라우저에서 쿠키를 지우면 사라지고, 그 뒤로는 새 ID로 구분합니다.</li>
            <li>
              구글 계정 정보와 남긴 내용의 삭제를 원하면 아래 문의처로 요청해 주세요. 계정을 지우면 계정 닉네임도 함께 지워지고, 남은 기록은 누구인지 알 수 없는
              ID로 남습니다.
            </li>
          </ul>
        </Section>

        <Section title="5. 맡기는 곳 (처리 위탁)">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Supabase: 데이터베이스와 로그인 처리</li>
            <li>Vercel: 웹 서비스 호스팅과 접속 통계(Web Analytics)</li>
            <li>Google: 구글 로그인(로그인을 고른 경우에만)</li>
            <li>네이버 지도, TMAP: 지도와 도보 경로 표시. 가게·캠퍼스 위치만 보내며 개인정보는 보내지 않습니다.</li>
            <li>
              인스타그램(Meta): 가게의 「인스타 오늘의 메뉴」 미리보기를 펼치면 인스타그램 화면을 불러옵니다. 이때 인스타그램이 자체 쿠키를 쓸 수 있으며, 지도는
              인스타그램에 개인정보를 보내지 않습니다.
            </li>
          </ul>
        </Section>

        <Section title="6. 문의">
          <p>
            개인정보 관련 문의나 삭제 요청은{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-brand underline">
              {CONTACT_EMAIL}
            </a>
            로 메일을 보내 주세요.
          </p>
          <p>이 방침이 바뀌면 이 페이지의 시행일을 고치고 내용을 갱신합니다.</p>
        </Section>
      </article>
    </main>
  );
}
