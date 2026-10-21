import { Suspense } from "react";
import { LunchMap } from "@/components/LunchMap";
import { PrototypeHost } from "@/components/prototype/PrototypeHost";

export default function Home() {
  // PROTOTYPE (throwaway): 개발 환경에서만 UI 시안 전환(?variant=)을 켠다. 배포 빌드는 항상 지금 화면.
  if (process.env.NODE_ENV === "production") return <LunchMap />;
  return (
    <Suspense>
      <PrototypeHost />
    </Suspense>
  );
}
